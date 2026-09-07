# full_time_spond_sync

Syncs fixtures from the FA Full Time website to Spond.

## Prerequisites

- Rust (via [rustup](https://rustup.rs))
- [just](https://just.systems) (`brew install just`)

## Building

```
just build
```

This installs `cmake` (required to compile BoringSSL for Cloudflare bypass) and builds the release binary.

## Usage

```
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> diff
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> sync
```
