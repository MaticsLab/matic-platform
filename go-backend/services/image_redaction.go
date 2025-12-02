package services

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"strings"
)

// RedactImageRequest contains the parameters for redacting an image
type RedactImageRequest struct {
	ImageURL  string        `json:"image_url"`
	Locations []PIILocation `json:"locations"`
}

// RedactImage downloads an image and applies black boxes over the specified locations
func RedactImage(imageURL string, locations []PIILocation) ([]byte, string, error) {
	// Download the image
	resp, err := http.Get(imageURL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
	}

	// Read image data
	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read image data: %w", err)
	}

	// Detect content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(imgData)
	}

	// Decode the image
	var img image.Image
	var format string

	reader := bytes.NewReader(imgData)
	if strings.Contains(contentType, "png") {
		img, err = png.Decode(reader)
		format = "png"
	} else if strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg") {
		img, err = jpeg.Decode(reader)
		format = "jpeg"
	} else {
		// Try generic decode
		reader.Seek(0, 0)
		img, format, err = image.Decode(reader)
	}

	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Create a drawable image
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Create RGBA image for drawing
	rgba := image.NewRGBA(bounds)
	draw.Draw(rgba, bounds, img, bounds.Min, draw.Src)

	// Draw black rectangles over PII locations
	black := color.RGBA{0, 0, 0, 255}

	for _, loc := range locations {
		if loc.BoundingBox == nil {
			continue
		}

		// Get bounding box values
		bx := loc.BoundingBox.X
		by := loc.BoundingBox.Y
		bw := loc.BoundingBox.Width
		bh := loc.BoundingBox.Height

		// Check if coordinates are in percentage (0-100) or pixel format instead of normalized (0-1)
		// If any coordinate is > 1 and looks like percentage or pixel, normalize it
		if bx > 1 || by > 1 || bw > 1 || bh > 1 {
			// Check if it looks like percentage (values <= 100)
			if bx <= 100 && by <= 100 && bw <= 100 && bh <= 100 {
				// Treat as percentage
				bx = bx / 100
				by = by / 100
				bw = bw / 100
				bh = bh / 100
			} else {
				// Treat as pixel coordinates - normalize
				bx = bx / float64(width)
				by = by / float64(height)
				bw = bw / float64(width)
				bh = bh / float64(height)
			}
		}

		// Convert normalized coordinates to pixel coordinates
		x := int(bx * float64(width))
		y := int(by * float64(height))
		w := int(bw * float64(width))
		h := int(bh * float64(height))

		// Ensure minimum size for visibility
		if w < 10 {
			w = 10
		}
		if h < 10 {
			h = 10
		}

		// Add some padding
		padding := 4
		x = max(0, x-padding)
		y = max(0, y-padding)
		w = min(width-x, w+padding*2)
		h = min(height-y, h+padding*2)

		// Draw black rectangle
		rect := image.Rect(x, y, x+w, y+h)
		draw.Draw(rgba, rect, &image.Uniform{black}, image.Point{}, draw.Src)
	}

	// Encode the result
	var buf bytes.Buffer
	var outContentType string

	if format == "png" {
		err = png.Encode(&buf, rgba)
		outContentType = "image/png"
	} else {
		err = jpeg.Encode(&buf, rgba, &jpeg.Options{Quality: 90})
		outContentType = "image/jpeg"
	}

	if err != nil {
		return nil, "", fmt.Errorf("failed to encode image: %w", err)
	}

	return buf.Bytes(), outContentType, nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
