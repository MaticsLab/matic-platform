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

// RedactImage downloads an image and applies black boxes over the specified PII locations
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
	imageData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read image data: %w", err)
	}

	// Detect content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(imageData)
	}

	// If no locations, return original
	if len(locations) == 0 {
		return imageData, contentType, nil
	}

	// Decode the image
	reader := bytes.NewReader(imageData)
	img, format, err := image.Decode(reader)
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

	// Draw black boxes over each PII location
	black := color.RGBA{0, 0, 0, 255}

	for _, loc := range locations {
		if loc.BoundingBox == nil {
			continue
		}

		// Convert normalized coordinates (0-1) to pixel coordinates
		x := int(loc.BoundingBox.X * float64(width))
		y := int(loc.BoundingBox.Y * float64(height))
		w := int(loc.BoundingBox.Width * float64(width))
		h := int(loc.BoundingBox.Height * float64(height))

		// Add padding
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
	var outputType string

	if strings.Contains(format, "png") || strings.Contains(contentType, "png") {
		err = png.Encode(&buf, rgba)
		outputType = "image/png"
	} else {
		err = jpeg.Encode(&buf, rgba, &jpeg.Options{Quality: 90})
		outputType = "image/jpeg"
	}

	if err != nil {
		return nil, "", fmt.Errorf("failed to encode image: %w", err)
	}

	return buf.Bytes(), outputType, nil
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
