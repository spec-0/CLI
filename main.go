package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/winspect-labs/winspect-cli/internal/resolve"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "resolve" {
		fmt.Fprintln(os.Stderr, "Usage: spec0 resolve --spec path/to/api-spec.yaml [--output -]")
		os.Exit(1)
	}

	// Parse flags for resolve subcommand (skip "resolve")
	fs := flag.NewFlagSet("resolve", flag.ExitOnError)
	specPath := fs.String("spec", "", "Path to api-spec.yaml (required)")
	outputPath := fs.String("output", "-", "Output path (- for stdout)")
	_ = fs.Parse(os.Args[2:])

	if *specPath == "" {
		fmt.Fprintln(os.Stderr, "Error: --spec is required")
		fs.Usage()
		os.Exit(1)
	}

	if err := resolve.Resolve(*specPath, *outputPath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
