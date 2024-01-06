use full_time_spond_sync::FixturesDiff;

pub mod full_time;
pub mod spond;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    let full_times_fixtures = full_time::get_upcoming_fixtures(
        full_time::SeasonId::new(835701142),
        &full_time::Team {
            id: full_time::TeamId::new(372755773),
            name: full_time::TeamName::new("Twyford Comets FC U7 Stormtroopers"),
        },
    )
    .await?;

    let spond_credentials = spond::UserCredentials {
        email: args.get(1).unwrap().to_string(),
        password: args.get(2).unwrap().to_string(),
    };
    let spond_session = spond::login(&spond_credentials).await?;
    let spond_fixtures = spond::get_upcoming_fixtures(
        spond::GroupId::new("12BC6CAB8503463C8845B14A6CBC8D4A"),
        spond::SubGroupId::new("E5D605768156447E862502FCFF25F9AA"),
        &spond_session,
    )
    .await?;
    let diff = FixturesDiff::new(full_times_fixtures, spond_fixtures);

    println!("{:#?}", diff);
    spond::create_fixtures(&diff.new, &spond_session).await?;
    Ok(())
}
