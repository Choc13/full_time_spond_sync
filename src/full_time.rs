use chrono::prelude::*;
use chrono_tz::{Europe::London, Tz};
use reqwest::Error;
use scraper::{ElementRef, Html, Selector};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeasonId(i32);

impl SeasonId {
    pub fn new(x: i32) -> Self {
        Self(x)
    }
}

impl std::ops::Deref for SeasonId {
    type Target = i32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TeamId(i32);

impl TeamId {
    pub fn new(x: i32) -> Self {
        Self(x)
    }
}

impl std::ops::Deref for TeamId {
    type Target = i32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct TeamName(String);

impl TeamName {
    pub fn new(s: &str) -> Self {
        TeamName(s.to_string())
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Team {
    pub id: TeamId,
    pub name: TeamName,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FixtureType {
    Cup,
    League,
}

#[derive(Copy, Debug, Clone, PartialEq, Eq)]
pub enum FixtureSide {
    Home,
    Away,
}

#[derive(Copy, Debug, Clone, PartialEq, Eq)]
pub enum Venue {
    Goals,
    KingsAcademy,
    WoodfordPark,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fixture {
    pub typ: FixtureType,
    pub side: FixtureSide,
    pub date_time: DateTime<Tz>,
    pub opposition: String,
    pub venue: Venue,
}

fn parse_fixture_type(cell: &ElementRef) -> FixtureType {
    match cell.inner_html().trim().to_lowercase().as_str() {
        "l" | "o" => FixtureType::League,
        "cup" => FixtureType::Cup,
        x => panic!("Unknown fixture type {x}."),
    }
}

fn parse_fixture_time(cell: &ElementRef) -> DateTime<Tz> {
    match cell
        .select(&Selector::parse("span").unwrap())
        .collect::<Vec<_>>()[..]
    {
        [date, time] => {
            let date_time = format!("{} {}", date.inner_html().trim(), time.inner_html().trim());
            NaiveDateTime::parse_from_str(&date_time, "%d/%m/%y %H:%M")
                .expect(&format!(
                    "Invalid date time format when parsing {date_time}."
                ))
                .and_local_timezone(London)
                .single()
                .expect("Not a valid London time.")
        }
        _ => panic!("Expected exactly two span elements when parsing date time."),
    }
}

fn try_parse_opposition(cell: &ElementRef, team_name: &TeamName) -> Option<String> {
    match cell
        .select(&Selector::parse("a").unwrap())
        .flat_map(|x| x.text().map(|s| s.trim()))
        .collect::<Vec<_>>()[..]
    {
        [opposition] => {
            if opposition.eq_ignore_ascii_case(&team_name.0) {
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
        _ => panic!("Team wasn't listed as either home or away for this fixture."),
    }
}

fn parse_venue(cell: &ElementRef) -> Venue {
    let venue_name = cell.inner_html().trim().to_lowercase();
    if venue_name.contains("goals") {
        Venue::Goals
    } else if venue_name.contains("woodford") {
        Venue::WoodfordPark
    } else if venue_name.contains("kings academy") {
        Venue::KingsAcademy
    } else {
        panic!("Unknown venue {}", venue_name)
    }
}

fn parse_fixture<'a>(row: impl Iterator<Item = ElementRef<'a>>, team_name: &TeamName) -> Fixture {
    let row = row.collect::<Vec<_>>();
    match &row[..] {
        [typ, date_time, home_team, _, _, _, away_team, venue] => {
            let (fixture_side, opposition) = parse_teams(home_team, away_team, team_name);
            Fixture {
                typ: parse_fixture_type(typ),
                side: fixture_side,
                date_time: parse_fixture_time(date_time),
                opposition,
                venue: parse_venue(venue),
            }
        }
        _ => panic!("Incorrect number of cells in table row."),
    }
}

pub async fn get_upcoming_fixtures(
    season_id: SeasonId,
    team: &Team,
) -> Result<Vec<Fixture>, Error> {
    let url = format!(
        "https://fulltime.thefa.com/displayTeam.html?divisionseason={}&teamID={}",
        *season_id, *team.id
    );
    let html = reqwest::get(url).await?.text().await?;
    let document = Html::parse_document(&html);
    let tables = document
        .select(&Selector::parse("div.fixtures-table table").unwrap())
        .collect::<Vec<_>>();
    let table = match tables[..] {
        [] => return Ok(vec![]),
        [t] => t,
        _ => panic!(
            "Expected to find one fixture table, but found {}.",
            tables.len()
        ),
    };
    let td_selector = Selector::parse("td").unwrap();
    Ok(table
        .select(&Selector::parse("tbody tr").unwrap())
        .map(|tr| tr.select(&td_selector))
        .map(|r| parse_fixture(r, &team.name))
        .filter(|f| f.date_time.with_timezone(&Utc) >= Utc::now())
        .collect::<Vec<_>>())
}
