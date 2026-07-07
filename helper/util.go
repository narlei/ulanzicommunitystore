package main

import "os/exec"

// runCmd roda um comando e retorna erro (usado para launchctl).
func runCmd(name string, args ...string) error {
	return exec.Command(name, args...).Run()
}
