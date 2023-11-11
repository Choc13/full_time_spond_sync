use crate::{Fixture, FixtureSide, FixtureType};
use chrono::prelude::*;
use chrono_tz::GB;
use reqwest::Error;
use scraper::{ElementRef, Html, Selector};

#[derive(Clone, Copy)]
pub struct TeamId(i32);

impl TeamId {
    pub fn new(x: i32) -> TeamId {
        TeamId(x)
    }
}

impl std::ops::Deref for TeamId {
    type Target = i32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct TeamName<'a>(pub &'a str);

pub struct Team<'a> {
    pub id: TeamId,
    pub name: TeamName<'a>,
}

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
            let date_time = format!("{} {}", date.inner_html().trim(), time.inner_html().trim());
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
        _ => panic!("Team wasn't listed as either home or away for this fixture."),
    }
}

fn parse_fixture<'a>(row: impl Iterator<Item = ElementRef<'a>>, team_name: &TeamName) -> Fixture {
    let row = row.collect::<Vec<_>>();
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

pub async fn get_upcoming_fixtures(team: &Team<'_>) -> Result<Vec<Fixture>, Error> {
    let html = reqwest::get(format!(
        "https://fulltime.thefa.com/displayTeam.html?divisionseason=756007599&teamID={}",
        *team.id
    ))
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
    let td_selector = Selector::parse("td").unwrap();
    Ok(table
        .select(&Selector::parse("tbody tr").unwrap())
        .map(|tr| tr.select(&td_selector))
        .map(|r| parse_fixture(r, &team.name))
        .collect::<Vec<_>>())
}
