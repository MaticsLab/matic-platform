package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Bucket names as referenced by the rest of the app (matching the Supabase Storage
// bucket names they replace, so call sites don't need to change).
const (
	BucketWorkspaceAssets = "workspace-assets"
	BucketUserAssets      = "user-assets"
)

type bucketConfig struct {
	name            string // actual Railway bucket name (has a random suffix)
	accessKeyID     string
	secretAccessKey string
	region          string
}

var (
	storageClients   = map[string]*s3.Client{}
	storageBuckets   = map[string]bucketConfig{}
	storageInitOnce  sync.Once
	storageInitError error
)

func initStorage() {
	endpoint := os.Getenv("STORAGE_ENDPOINT")
	if endpoint == "" {
		storageInitError = fmt.Errorf("STORAGE_ENDPOINT not set")
		return
	}

	buckets := map[string]bucketConfig{
		BucketWorkspaceAssets: {
			name:            os.Getenv("WORKSPACE_ASSETS_BUCKET"),
			accessKeyID:     os.Getenv("WORKSPACE_ASSETS_ACCESS_KEY_ID"),
			secretAccessKey: os.Getenv("WORKSPACE_ASSETS_SECRET_ACCESS_KEY"),
			region:          os.Getenv("WORKSPACE_ASSETS_REGION"),
		},
		BucketUserAssets: {
			name:            os.Getenv("USER_ASSETS_BUCKET"),
			accessKeyID:     os.Getenv("USER_ASSETS_ACCESS_KEY_ID"),
			secretAccessKey: os.Getenv("USER_ASSETS_SECRET_ACCESS_KEY"),
			region:          os.Getenv("USER_ASSETS_REGION"),
		},
	}

	for alias, cfg := range buckets {
		if cfg.name == "" || cfg.accessKeyID == "" || cfg.secretAccessKey == "" {
			// Not configured — skip; callers get a clear error at use time.
			continue
		}

		awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
			awsconfig.WithRegion(cfg.region),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.accessKeyID, cfg.secretAccessKey, "")),
		)
		if err != nil {
			storageInitError = fmt.Errorf("failed to load AWS config for bucket %s: %w", alias, err)
			return
		}

		client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = false // Railway buckets use virtual-host style URLs
		})

		storageClients[alias] = client
		storageBuckets[alias] = cfg
	}
}

// UploadObject uploads fileData to the given bucket alias (BucketWorkspaceAssets or
// BucketUserAssets) at storagePath, and returns a stable URL the app can store and
// reuse indefinitely — it proxies back through this backend's own
// GET /api/v1/storage/object/:bucket/*path route rather than a raw (non-public,
// signature-requiring) S3 URL, since these buckets are private by default.
func UploadObject(bucketAlias string, storagePath string, fileData io.Reader, contentType string) (string, error) {
	storageInitOnce.Do(initStorage)
	if storageInitError != nil {
		return "", storageInitError
	}

	client, ok := storageClients[bucketAlias]
	if !ok {
		return "", fmt.Errorf("storage bucket %q is not configured", bucketAlias)
	}
	cfg := storageBuckets[bucketAlias]

	_, err := client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.name),
		Key:         aws.String(storagePath),
		Body:        fileData,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload to %s: %w", bucketAlias, err)
	}

	return PublicURL(bucketAlias, storagePath), nil
}

// DeleteObject removes an object from the given bucket alias.
func DeleteObject(bucketAlias string, storagePath string) error {
	storageInitOnce.Do(initStorage)
	if storageInitError != nil {
		return storageInitError
	}

	client, ok := storageClients[bucketAlias]
	if !ok {
		return fmt.Errorf("storage bucket %q is not configured", bucketAlias)
	}
	cfg := storageBuckets[bucketAlias]

	_, err := client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(cfg.name),
		Key:    aws.String(storagePath),
	})
	if err != nil {
		return fmt.Errorf("failed to delete from %s: %w", bucketAlias, err)
	}
	return nil
}

// GetObject streams an object's bytes and content type from the given bucket alias.
func GetObject(bucketAlias string, storagePath string) (io.ReadCloser, string, error) {
	storageInitOnce.Do(initStorage)
	if storageInitError != nil {
		return nil, "", storageInitError
	}

	client, ok := storageClients[bucketAlias]
	if !ok {
		return nil, "", fmt.Errorf("storage bucket %q is not configured", bucketAlias)
	}
	cfg := storageBuckets[bucketAlias]

	out, err := client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(cfg.name),
		Key:    aws.String(storagePath),
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to fetch from %s: %w", bucketAlias, err)
	}

	contentType := "application/octet-stream"
	if out.ContentType != nil {
		contentType = *out.ContentType
	}
	return out.Body, contentType, nil
}

// PublicURL builds the stable backend-proxied URL for an object, given the app's own
// public base URL (NEXT_PUBLIC_GO_API_URL or a request-derived fallback). storagePath's
// "/" separators are preserved as literal path segments (not percent-encoded) so Gin's
// *path wildcard route can match it directly.
func PublicURL(bucketAlias string, storagePath string) string {
	base := strings.TrimRight(os.Getenv("NEXT_PUBLIC_GO_API_URL"), "/")
	if base == "" {
		base = "http://localhost:8080/api/v1"
	}
	return fmt.Sprintf("%s/storage/object/%s/%s", base, bucketAlias, strings.TrimLeft(storagePath, "/"))
}

// ParseObjectURL reports whether a URL was produced by PublicURL for the given bucket
// alias, and if so extracts the storage path (used when a caller only has a stored URL
// and needs to delete the underlying object, mirroring the old
// `url.split('/bucket/').pop()` pattern).
func ParseObjectURL(publicURL string, bucketAlias string) (storagePath string, ok bool) {
	marker := "/storage/object/" + bucketAlias + "/"
	idx := strings.Index(publicURL, marker)
	if idx == -1 {
		return "", false
	}
	return publicURL[idx+len(marker):], true
}
