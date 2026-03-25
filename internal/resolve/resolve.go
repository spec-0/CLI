package resolve

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// ApiSpec represents the source api-spec.yaml structure (with ref before resolution)
type ApiSpec struct {
	APIVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Metadata   map[string]any    `yaml:"metadata"`
	Spec       ApiSpecSpec       `yaml:"spec"`
}

type ApiSpecSpec struct {
	Name         string              `yaml:"name"`
	Owner        string              `yaml:"owner"`
	Type         string              `yaml:"type"`
	GitSha       string              `yaml:"gitSha"`
	GitHubRepo   string              `yaml:"githubRepo"`
	GitHubBranch string              `yaml:"githubBranch"`
	SpecFilePath string              `yaml:"specFilePath"`
	Definition   ApiSpecDefinition   `yaml:"definition"`
}

type ApiSpecDefinition struct {
	Ref         string `yaml:"ref"`
	Inline      string `yaml:"inline"`
	ConfigMapRef *struct {
		Name string `yaml:"name"`
		Key  string `yaml:"key"`
	} `yaml:"configMapRef"`
}

// Resolve parses the api-spec.yaml, resolves tokens, and optionally embeds spec content.
func Resolve(specPath, outputPath string) error {
	data, err := os.ReadFile(specPath)
	if err != nil {
		return fmt.Errorf("read spec: %w", err)
	}

	var spec ApiSpec
	if err := yaml.Unmarshal(data, &spec); err != nil {
		return fmt.Errorf("parse spec: %w", err)
	}

	specDir := filepath.Dir(specPath)

	// Resolve tokens
	specSha := ""
	if spec.Spec.Definition.Ref != "" {
		refPath := spec.Spec.Definition.Ref
		if !filepath.IsAbs(refPath) {
			refPath = filepath.Join(specDir, refPath)
		}
		specSha, err = gitLogFormat(refPath, "%H")
		if err != nil {
			return fmt.Errorf("get SPEC_SHA for %s: %w", refPath, err)
		}
	}

	gitSha, _ := gitRevParse(specDir, "HEAD")
	branch, _ := gitRevParse(specDir, "--abbrev-ref", "HEAD")
	if branch == "" {
		branch = "main"
	}

	// Replace tokens in the raw YAML string to preserve structure
	replaced := string(data)
	replaced = strings.ReplaceAll(replaced, "${SPEC_SHA}", specSha)
	replaced = strings.ReplaceAll(replaced, "${GIT_SHA}", gitSha)
	replaced = strings.ReplaceAll(replaced, "${BRANCH}", branch)

	// Re-parse to apply inline embedding if ref is present
	if err := yaml.Unmarshal([]byte(replaced), &spec); err != nil {
		return fmt.Errorf("re-parse after token replace: %w", err)
	}

	// If definition has ref, read file and embed as inline
	if spec.Spec.Definition.Ref != "" {
		refPath := spec.Spec.Definition.Ref
		if !filepath.IsAbs(refPath) {
			refPath = filepath.Join(specDir, refPath)
		}
		content, err := os.ReadFile(refPath)
		if err != nil {
			return fmt.Errorf("read ref file %s: %w", refPath, err)
		}
		spec.Spec.Definition.Inline = string(content)
		spec.Spec.Definition.Ref = ""
	}

	// Ensure gitSha is set in spec
	if spec.Spec.GitSha == "" || isToken(spec.Spec.GitSha) {
		spec.Spec.GitSha = specSha
	}

	out, err := yaml.Marshal(&spec)
	if err != nil {
		return fmt.Errorf("marshal output: %w", err)
	}

	if outputPath == "-" {
		_, err = os.Stdout.Write(out)
		return err
	}
	return os.WriteFile(outputPath, out, 0644)
}

func isToken(s string) bool {
	return strings.HasPrefix(s, "${") && strings.Contains(s, "}")
}

func gitLogFormat(path, format string) (string, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	// Run from directory containing the file so git can resolve it
	cmd := exec.Command("git", "log", "-1", "--format="+format, "--", filepath.Base(absPath))
	cmd.Dir = filepath.Dir(absPath)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func gitRevParse(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"rev-parse"}, args...)...)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// TokenRegex matches ${TOKEN_NAME} patterns
var TokenRegex = regexp.MustCompile(`\$\{([A-Z_]+)\}`)
