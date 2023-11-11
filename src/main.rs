use full_time_spond_sync::{full_time, TeamName};
use scraper::{Html, Selector};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let team_name = TeamName("Twyford Comets FC U7 Stormtroopers");
    let html = reqwest::get(
        "https://fulltime.thefa.com/displayTeam.html?divisionseason=756007599&teamID=372755773",
    )
    .await?
    .text()
    .await?;
    let document = Html::parse_document(&html);
    let tables = document
        .select(&Selector::parse("div.fixtures-table table").unwrap())
        .collect::<Vec<_>>();
    let table = match tables[..] {
        [t] => t,
        _ => panic!(
            "Expected to find one fixture table, but found {}.",
            tables.len()
        ),
    };
    let rows = table
        .select(&Selector::parse("tbody tr").unwrap())
        .map(|tr| {
            tr.select(&Selector::parse("td").unwrap())
                .collect::<Vec<_>>()
        })
        .map(|r| full_time::parse_fixture(&r, &team_name))
        .collect::<Vec<_>>();
    println!("{:#?}", rows);
    Ok(())
}
