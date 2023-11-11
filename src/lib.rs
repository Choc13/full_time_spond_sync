use chrono::prelude::*;

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

pub struct TeamName<'a>(pub &'a str);

pub mod full_time;
