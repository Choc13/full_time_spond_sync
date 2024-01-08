use full_time_spond_sync::{spond, sync, Team};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    sync(
        Team::Jedis,
        &spond::UserCredentials {
            email: args.get(1).unwrap().to_string(),
            password: args.get(2).unwrap().to_string(),
        },
        spond::GroupId::new("12BC6CAB8503463C8845B14A6CBC8D4A"),
    )
    .await
}
