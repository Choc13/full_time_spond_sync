use full_time_spond_sync::full_time;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let team = full_time::Team {
        id: full_time::TeamId::new(372755773),
        name: full_time::TeamName("Twyford Comets FC U7 Stormtroopers"),
    };
    let rows = full_time::get_upcoming_fixtures(&team).await?;
    println!("{:#?}", rows);
    Ok(())
}
