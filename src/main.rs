use chrono::prelude::*;
use scraper::{Html, Selector};

#[derive(Debug)]
pub enum FixtureType {
    Cup,
    League,
}

#[derive(Debug)]
pub enum FixtureSide {
    Home,
    Away,
}

#[derive(Debug)]
pub struct Fixture {
    fixture_type: FixtureType,
    fixture_side: FixtureSide,
    date_time: DateTime<Utc>,
    opposition: String,
}

#[derive(Clone, Copy)]
pub struct TeamId(i32);

pub struct TeamName<'a>(&'a str);

pub mod full_time {
    use crate::{Fixture, FixtureSide, FixtureType, TeamName};
    use chrono::prelude::*;
    use chrono_tz::GB;
    use scraper::{ElementRef, Selector};

    fn parse_fixture_type(cell: &ElementRef) -> FixtureType {
        match cell.inner_html().trim().to_lowercase().as_str() {
            "l" => FixtureType::League,
            "cup" => FixtureType::Cup,
            x => panic!("Unknown fixture type {x}."),
        }
    }

    fn parse_fixture_time(cell: &ElementRef) -> DateTime<Utc> {
        match cell
            .select(&Selector::parse("span").unwrap())
            .collect::<Vec<_>>()[..]
        {
            [date, time] => {
                let date_time =
                    format!("{} {}", date.inner_html().trim(), time.inner_html().trim());
                NaiveDateTime::parse_from_str(&date_time, "%d/%m/%y %H:%M")
                    .expect(&format!(
                        "Invalid date time format when parsing {date_time}."
                    ))
                    .and_local_timezone(GB)
                    .single()
                    .expect("Not a valid GB time.")
                    .with_timezone(&Utc)
            }
            _ => panic!("Expected exactly two span elements when parsing date time."),
        }
    }

    fn try_parse_opposition(cell: &ElementRef, team_name: &TeamName) -> Option<String> {
        match &cell
            .select(&Selector::parse("a").unwrap())
            .map(|x| x.inner_html().trim().to_string())
            .collect::<Vec<_>>()[..]
        {
            [opposition] => {
                if opposition.eq_ignore_ascii_case(team_name.0) {
                    None
                } else {
                    Some(opposition.to_owned())
                }
            }
            _ => panic!("Expected a single anchor tag when parsing team name."),
        }
    }

    fn parse_teams(
        home: &ElementRef,
        away: &ElementRef,
        team_name: &TeamName,
    ) -> (FixtureSide, String) {
        match (
            try_parse_opposition(home, team_name),
            try_parse_opposition(away, team_name),
        ) {
            (Some(opposition), None) => (FixtureSide::Away, opposition),
            (None, Some(opposition)) => (FixtureSide::Home, opposition),
            _ => panic!("Team wasn't list as either home or away for this fixture."),
        }
    }

    pub fn parse_fixture(row: &Vec<ElementRef>, team_name: &TeamName) -> Fixture {
        match &row[..] {
            [typ, date_time, home_team, _, _, _, away_team, _] => {
                let (fixture_side, opposition) = parse_teams(home_team, away_team, team_name);
                Fixture {
                    fixture_type: parse_fixture_type(typ),
                    fixture_side,
                    date_time: parse_fixture_time(date_time),
                    opposition,
                }
            }
            _ => panic!("Incorrect number of cells in table row."),
        }
    }
}

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
