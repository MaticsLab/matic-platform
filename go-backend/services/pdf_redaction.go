package services

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

// RedactPDF downloads a PDF and applies black boxes over the specified locations
func RedactPDF(pdfURL string, locations []PIILocation) ([]byte, error) {
	// Download the PDF
	resp, err := http.Get(pdfURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download PDF: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download PDF: status %d", resp.StatusCode)
	}

	// Read PDF data
	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDF data: %w", err)
	}

	// If no locations, return original
	if len(locations) == 0 {
		return pdfData, nil
	}

	// Filter locations with bounding boxes
	var validLocations []PIILocation
	for _, loc := range locations {
		if loc.BoundingBox != nil {
			validLocations = append(validLocations, loc)
		}
	}

	if len(validLocations) == 0 {
		return pdfData, nil
	}

	// Get PDF dimensions using pdfcpu
	inputReader := bytes.NewReader(pdfData)
	conf := model.NewDefaultConfiguration()
	
	ctx, err := pdfcpu.Read(inputReader, conf)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDF: %w", err)
	}

	// Get page dimensions
	dims, err := ctx.PageDims()
	if err != nil || len(dims) == 0 {
		// Use default A4 dimensions if we can't get them
		dims = []types.Dim{{Width: 612, Height: 792}}
	}

	pageWidth := dims[0].Width
	pageHeight := dims[0].Height

	// Apply redactions using watermarks
	currentData := pdfData

	for _, loc := range validLocations {
		// Convert normalized coordinates to PDF coordinates
		// PDF coordinates: origin at bottom-left, Y goes up
		// Our normalized coords: origin at top-left, Y goes down
		x := loc.BoundingBox.X * pageWidth
		y := (1 - loc.BoundingBox.Y - loc.BoundingBox.Height) * pageHeight
		w := loc.BoundingBox.Width * pageWidth
		h := loc.BoundingBox.Height * pageHeight

		// Ensure minimum size
		if w < 20 {
			w = 20
		}
		if h < 10 {
			h = 10
		}

		// Add padding
		padding := 4.0
		x = maxFloat(0, x-padding)
		y = maxFloat(0, y-padding)
		w = w + padding*2
		h = h + padding*2

		// Create watermark description for solid black rectangle
		// Using a filled rectangle via text watermark with background color
		wmDesc := fmt.Sprintf("sc:1 abs, pos:bl, off:%.1f %.1f, fillc:#000000, bgcol:#000000, rot:0, op:1", x, y)
		
		// Create black bar text (series of block chars)
		barText := createBlackBar(int(w/6), int(h/10))
		
		wm, err := pdfcpu.ParseTextWatermarkDetails(barText, wmDesc, true, types.POINTS)
		if err != nil {
			// Skip this redaction if parsing fails
			continue
		}

		// Apply watermark
		inputReader := bytes.NewReader(currentData)
		var outputBuf bytes.Buffer

		err = api.AddWatermarks(inputReader, &outputBuf, nil, wm, conf)
		if err != nil {
			// Skip this redaction if it fails
			continue
		}

		currentData = outputBuf.Bytes()
	}

	return currentData, nil
}

// createBlackBar creates a string of block characters to form a solid bar
func createBlackBar(width, height int) string {
	if width < 1 {
		width = 1
	}
	if width > 50 {
		width = 50
	}
	
	bar := ""
	for i := 0; i < width; i++ {
		bar += "█"
	}
	return bar
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
