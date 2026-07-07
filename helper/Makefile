BIN := ulanzideck-store-helper
DIST := dist

.PHONY: build clean vet run darwin

build:
	go build -o $(BIN) .

vet:
	go vet ./...

run:
	go run . run

# Binários de release (macOS por enquanto; Windows/Linux ficam prontos pra fase 2).
darwin:
	mkdir -p $(DIST)
	GOOS=darwin GOARCH=arm64 go build -o $(DIST)/$(BIN)-darwin-arm64 .
	GOOS=darwin GOARCH=amd64 go build -o $(DIST)/$(BIN)-darwin-amd64 .

clean:
	rm -rf $(BIN) $(DIST)
