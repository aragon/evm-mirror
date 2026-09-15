# Env vars the binary is allowed to read (mirrors deno.json build tasks)
allow_env := "ETHERSCAN_API_KEY"

# Show available commands
help:
    @just --list --unsorted

# Type-check the source graph (tests are type-checked by `just test`)
[group('dev')]
check:
    deno check main.ts

# Run the test suite
[group('dev')]
test:
    deno task test

# Format sources with deno fmt
[group('dev')]
fmt:
    deno fmt main.ts lib/

# Refresh the dependency lock (call after editing deno.json)
[group('dev')]
cache:
    deno cache main.ts lib/providers/*_test.ts

# Verify contracts against local sources (see `mirror verify --help`)
[group('run')]
verify *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} main.ts verify {{args}}

# Diff two on-chain contracts (see `mirror diff --help`)
[group('run')]
diff *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} main.ts diff {{args}}

# Clone a verified contract into a local Foundry project (see `mirror clone --help`)
[group('run')]
clone *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} --allow-write main.ts clone {{args}}

# Build the binary for the current platform
[linux]
[group('build')]
build: build-linux

# Build the binary for the current platform
[macos]
[group('build')]
build:
    just build-{{ if arch() == "aarch64" { "macos" } else { "macos-x86" } }}

# Build the binary for the current platform
[windows]
[group('build')]
build: build-win

# Compile the linux (x86_64) binary
[group('build')]
build-linux:
    deno task build:linux

# Compile the macOS (aarch64) binary
[group('build')]
build-macos:
    deno task build:macos

# Compile the macOS (x86_64) binary
[group('build')]
build-macos-x86:
    deno task build:macos:x86

# Compile the windows (x86_64) binary
[group('build')]
build-win:
    deno task build:win

# Compile binaries for every supported target
[group('build')]
build-all: build-linux build-macos build-macos-x86 build-win

# Remove built binaries from the working tree
[group('build')]
clean:
    rm -f mirror mirror.exe
