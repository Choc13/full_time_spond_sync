use std::collections::HashMap;

use clap::{Parser, Subcommand};

use full_time_spond_sync::{spond, sync, team, SyncType};

#[derive(Subcommand, Debug)]
enum SubCommand {
    /// Diff the fixtures and sync the changes with Spond
    Sync,
    /// Diff the fixtures and print the changes without syncing to Spond
    Diff,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// An admin's Spond username
    #[arg(short, long)]
    email: String,

    /// An admin's Spond password
    #[arg(short, long)]
    password: String,

    // The teams to run for
    #[arg(long, value_delimiter = ',')]
    teams: Vec<String>,

    #[command(subcommand)]
    cmd: SubCommand,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let creds = spond::UserCredentials {
        email: args.email,
        password: args.password,
    };
    let teams = team::load()?;
    let team_lookup = teams
        .into_iter()
        .map(|t| (t.name.to_lowercase(), t))
        .collect::<HashMap<_, _>>();

    for team_name in args.teams {
        let team = team_lookup.get(&team_name.to_lowercase());
        match team {
            Some(team) => {
                sync(
                    team,
                    &creds,
                    spond::GroupId::new("12BC6CAB8503463C8845B14A6CBC8D4A"),
                    match args.cmd {
                        SubCommand::Diff => SyncType::Dry,
                        SubCommand::Sync => SyncType::Real,
                    },
                )
                .await?
            }
            None => {
                println!("Unknown team name: {}", team_name);
            }
        }
    }
    Ok(())
}
