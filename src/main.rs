use full_time_spond_sync::FixturesDiff;

pub mod full_time;
pub mod spond;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let full_time_team = full_time::Team {
        id: full_time::TeamId::new(372755773),
        name: full_time::TeamName::new("Twyford Comets FC U7 Stormtroopers"),
    };
    let spond_team_id = spond::TeamId::new("");
    let sink_fixtures = full_time::get_upcoming_fixtures(&full_time_team).await?;
    let source_fixtures = spond::get_upcoming_fixtures(&spond_team_id).await?;
    let diff = FixturesDiff::new(source_fixtures, sink_fixtures);

    spond::create_fixtures(diff.new.clone()).await?;
    println!("{:#?}", diff);
    Ok(())
}
