use clap::{Parser, Subcommand};

use full_time_spond_sync::{spond, sync, SyncType, Team};

// impl clap::ValueEnum for Team {
//     fn value_variants<'a>() -> &'a [Self] {
//         ["mandos", "jedis", "rebels", "stormtroopers"]
//     }

//     fn to_possible_value(&self) -> Option<clap::builder::PossibleValue> {
//         match self {
//             Team::Jedis => "jedi",
//             Team::Mandos => "mandos",
//             Team::Rebels => "rebels",
//             Team::Stormtroopers => "stormtroopers",
//         }
//     }
// }

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
    teams: Vec<Team>,

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

    for team in args.teams {
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
    Ok(())
}
