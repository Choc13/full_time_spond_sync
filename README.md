# full_time_spond_sync

Syncs fixtures from the FA Full Time website to Spond.

## Prerequisites

- Rust (via [rustup](https://rustup.rs))
- Python 3 with `curl_cffi`: `pip install curl_cffi`
- [just](https://just.systems) (`brew install just`)

## Building

```
just build
```

## Usage

```
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> diff
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> sync
```
