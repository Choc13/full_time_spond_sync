use std::collections::HashMap;

use chrono::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FixtureType {
    Cup,
    League,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FixtureSide {
    Home,
    Away,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fixture {
    pub fixture_type: FixtureType,
    pub fixture_side: FixtureSide,
    pub date_time: DateTime<Utc>,
    pub opposition: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TeamName(String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixturesDiff {
    pub new: Vec<Fixture>,
    pub modified: Vec<Fixture>,
    pub removed: Vec<Fixture>,
}

impl FixturesDiff {
    pub fn new(source_fixtures: Vec<Fixture>, sink_fixtures: Vec<Fixture>) -> Self {
        let source_fixtures = source_fixtures
            .iter()
            .cloned()
            .map(|f| (f.date_time.date_naive(), f))
            .collect::<HashMap<_, _>>();
        let sink_fixtures = sink_fixtures
            .iter()
            .cloned()
            .map(|f| (f.date_time.date_naive(), f))
            .collect::<HashMap<_, _>>();
        Self {
            new: source_fixtures
                .iter()
                .filter(|f| !sink_fixtures.contains_key(f.0))
                .map(|f| f.1.to_owned())
                .collect(),
            modified: source_fixtures
                .iter()
                .filter_map(|source| sink_fixtures.get(source.0).filter(|sink| source.1 != *sink))
                .cloned()
                .collect(),
            removed: sink_fixtures
                .iter()
                .filter(|f| !source_fixtures.contains_key(f.0))
                .map(|f| f.1.to_owned())
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    mod fixtures_diff {
        mod new {
            use crate::{Fixture, FixturesDiff};
            use chrono::{TimeZone, Utc};

            #[test]
            fn same_fixture_list_produces_no_diff() {
                let source = vec![];
                let sink = vec![];
                let diff = FixturesDiff::new(source, sink);
                assert!(
                    diff == FixturesDiff {
                        new: vec!(),
                        modified: vec!(),
                        removed: vec!()
                    }
                )
            }

            #[test]
            fn is_symmetrical() {
                let source = vec![Fixture {
                    fixture_type: crate::FixtureType::Cup,
                    fixture_side: crate::FixtureSide::Away,
                    date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 5, 0).unwrap(),
                    opposition: "Opponent".to_string(),
                }];
                let sink = vec![];
                let diff = FixturesDiff::new(source.clone(), sink.clone());
                let reverse_diff = FixturesDiff::new(sink, source);
                assert!(
                    diff == FixturesDiff {
                        new: reverse_diff.removed,
                        modified: reverse_diff.modified,
                        removed: reverse_diff.new
                    }
                )
            }

            #[test]
            fn considers_different_instances_on_the_same_date_as_modifications() {
                let fixture = Fixture {
                    fixture_type: crate::FixtureType::Cup,
                    fixture_side: crate::FixtureSide::Away,
                    date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 5, 0).unwrap(),
                    opposition: "Opponent".to_string(),
                };
                let modified = Fixture {
                    date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 10, 0).unwrap(),
                    ..fixture.clone()
                };
                let source = vec![fixture];
                let sink = vec![modified.clone()];
                let diff = FixturesDiff::new(source.clone(), sink.clone());
                assert!(
                    diff == FixturesDiff {
                        new: vec![],
                        modified: vec![modified],
                        removed: vec![]
                    }
                )
            }
        }
    }
}
