# Env vars the binary is allowed to read (mirrors deno.json build tasks)
allow_env := "ETHERSCAN_API_KEY,ETHERSCAN_URL,BLOCKSCOUT_URL,SOURCIFY_URL"

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

# Verify one or more on-chain contracts against local sources
# Example: just verify 0xABC 0xDEF --chain-id 1
[group('run')]
verify *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} main.ts verify {{args}}

# Diff two on-chain contracts
# Example: just diff 0xABC 0xDEF --chain-id 10
[group('run')]
diff *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} main.ts diff {{args}}

# Clone a verified contract into a local Foundry project
# Example: just clone 0xABC --output ./my-contract
[group('run')]
clone *args:
    deno run --allow-net --allow-read --allow-env={{allow_env}} --allow-write main.ts clone {{args}}

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
