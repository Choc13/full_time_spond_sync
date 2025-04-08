use chrono::{DateTime, Datelike, Duration, Utc};
use chrono_tz::Europe::London;
use spond::SubGroup;
use std::collections::HashMap;

pub mod full_time;
pub mod spond;

#[derive(Debug, Clone, Copy)]
pub enum Team {
    Jedis,
    Mandos,
    Rebels,
    Stormtroopers,
}

impl std::fmt::Display for Team {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Team::Jedis => "Jedis",
            Team::Mandos => "Mandos",
            Team::Rebels => "Rebels",
            Team::Stormtroopers => "Stormtroopers",
        })
    }
}

impl std::str::FromStr for Team {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "jedis" => Ok(Team::Jedis),
            "mandos" => Ok(Team::Mandos),
            "rebels" => Ok(Team::Rebels),
            "stormtroopers" => Ok(Team::Stormtroopers),
            _ => Err(format!("Invalid team {s}")),
        }
    }
}

impl Team {
    pub fn to_spond_sub_group_id(&self) -> spond::SubGroupId {
        spond::SubGroupId::new(match self {
            Team::Jedis => "CBED8EAA90DF4A40AA677F26CF070DAA",
            Team::Mandos => "5F88515880184BF980CE587A17AA3E1C",
            Team::Rebels => "4B09D34C9A9841D4A05B950511A68E62",
            Team::Stormtroopers => "E5D605768156447E862502FCFF25F9AA",
        })
    }

    pub fn to_full_time_team(&self) -> full_time::Team {
        let (id, name) = match self {
            Team::Jedis => (994929228, "Twyford Comets FC U8 Jedis"),
            Team::Mandos => (14943433, "Twyford Comets FC U8 Mandalorians"),
            Team::Rebels => (22659086, "Twyford Comets FC U8 Rebels"),
            Team::Stormtroopers => (372755773, "Twyford Comets FC U8 Stormtroopers"),
        };
        full_time::Team {
            id: full_time::TeamId::new(id),
            name: full_time::TeamName::new(name),
        }
    }

    pub fn current_full_time_season_id(&self) -> full_time::SeasonId {
        full_time::SeasonId::new(match self {
            Team::Jedis => 174810773,
            Team::Mandos => 523333942,
            Team::Rebels => 174810773,
            Team::Stormtroopers => 560206962,
        })
    }
}

impl spond::Spond {
    fn to_fixture(&self) -> Option<full_time::Fixture> {
        self.match_info
            .as_ref()
            .map(|match_info| full_time::Fixture {
                typ: match match_info.typ {
                    spond::MatchType::Tournament => full_time::FixtureType::Cup,
                    spond::MatchType::Home | spond::MatchType::Away => {
                        full_time::FixtureType::League
                    }
                },
                side: match match_info.typ {
                    spond::MatchType::Tournament | spond::MatchType::Home => {
                        full_time::FixtureSide::Home
                    }
                    spond::MatchType::Away => full_time::FixtureSide::Away,
                },
                date_time: self.start_timestamp,
                opposition: match_info.opponent_name.clone(),
                venue: self
                    .location
                    .as_ref()
                    .expect("All fixtures should have a location")
                    .to_full_time_venue(),
            })
    }
}

impl full_time::Fixture {
    fn to_spond_start_time(&self) -> DateTime<Utc> {
        self.date_time
    }

    fn to_spond_end_time(&self) -> DateTime<Utc> {
        self.date_time
            .checked_add_signed(Duration::hours(1))
            .unwrap()
    }

    fn to_spond_meetup_prior(&self) -> Option<u16> {
        if self
            .date_time
            .checked_sub_signed(Duration::minutes(15))
            .unwrap()
            .day()
            != self.date_time.day()
        {
            None
        } else {
            Some(15)
        }
    }

    fn to_spond_match_info(&self, sub_group: &SubGroup) -> spond::MatchInfo {
        spond::MatchInfo::new(
            sub_group.name.clone(),
            self.opposition.clone(),
            match self.typ {
                full_time::FixtureType::Cup => spond::MatchType::Tournament,
                full_time::FixtureType::League => match self.side {
                    full_time::FixtureSide::Home => spond::MatchType::Home,
                    full_time::FixtureSide::Away => spond::MatchType::Away,
                },
            },
        )
    }

    fn to_create_spond_request(
        &self,
        group: &spond::Group,
        sub_group_id: &spond::SubGroupId,
    ) -> spond::CreateSpondRequest {
        let sub_group = group
            .sub_groups
            .iter()
            .find(|sg| sg.id == *sub_group_id)
            .unwrap();
        let coach_role = group
            .roles
            .iter()
            .find(|r| r.name.to_lowercase() == "coach")
            .unwrap();
        let sub_group_members = group
            .members
            .iter()
            .filter(|m| m.sub_groups.contains(&sub_group_id));
        let coaches = sub_group_members
            .clone()
            .filter(|m| {
                m.roles
                    .as_ref()
                    .unwrap_or(&Vec::new())
                    .contains(&coach_role.id)
            })
            .map(|c| c.profile.clone());
        let players = sub_group_members.filter(|m| m.respondent);
        spond::CreateSpondRequest {
            heading: format!("{} - {}", sub_group.name, self.opposition),
            spond_type: spond::SpondType::Event,
            start_timestamp: self.to_spond_start_time(),
            end_timestamp: self.to_spond_end_time(),
            meetup_prior: self.to_spond_meetup_prior(),
            open_ended: false,
            comments_disabled: false,
            max_accepted: 0,
            rsvp_date: None,
            location: Some(spond::Location::from_full_time_venue(self.venue)),
            owners: coaches
                .filter_map(|c| c.map(|c| spond::Owner { id: c.id }))
                .collect(),
            visibility: spond::Visibility::Invitees,
            participants_hidden: false,
            auto_reminder_type: spond::AutoReminderType::Disabled,
            match_info: Some(self.to_spond_match_info(sub_group)),
            auto_accept: false,
            attachments: vec![],
            typ: spond::Type::Event,
            recipients: spond::Recipients {
                group_members: players.map(|p| p.id.clone()).collect(),
                group: spond::RecipientGroup {
                    id: group.id.clone(),
                    sub_groups: vec![sub_group.id.clone()],
                },
            },
        }
    }
}

impl spond::Spond {
    fn modify(
        &self,
        fixture: &full_time::Fixture,
        group: &spond::Group,
        sub_group_id: &spond::SubGroupId,
    ) -> Self {
        let sub_group = group
            .sub_groups
            .iter()
            .find(|sg| sg.id == *sub_group_id)
            .unwrap();
        Self {
            start_timestamp: fixture.to_spond_start_time(),
            end_timestamp: fixture.to_spond_end_time(),
            meetup_prior: fixture.to_spond_meetup_prior(),
            match_info: Some(fixture.to_spond_match_info(sub_group)),
            location: Some(spond::Location::from_full_time_venue(fixture.venue)),
            ..(self.clone())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diff {
    pub new: Vec<full_time::Fixture>,
    pub modified: Vec<(full_time::Fixture, spond::Spond)>,
    pub removed: Vec<spond::Spond>,
}

impl Diff {
    pub fn new(fixtures: Vec<full_time::Fixture>, sponds: Vec<spond::Spond>) -> Self {
        let fixtures = fixtures
            .iter()
            .cloned()
            .map(|f| (f.date_time.with_timezone(&London).date_naive(), f))
            .collect::<HashMap<_, _>>();
        let sponds = sponds
            .iter()
            .cloned()
            .map(|s| (s.start_timestamp.with_timezone(&London).date_naive(), s))
            .collect::<HashMap<_, _>>();
        Self {
            new: fixtures
                .iter()
                .filter(|f| !sponds.contains_key(f.0))
                .map(|f| f.1.to_owned())
                .collect(),
            modified: fixtures
                .iter()
                .filter_map(|(date, fixture)| {
                    sponds
                        .get(date)
                        .map(|spond| (fixture.clone(), spond.clone()))
                })
                .filter(|(fixture, spond)| spond.to_fixture().is_some_and(|s| s != *fixture))
                .collect(),
            removed: sponds
                .iter()
                .filter(|f| !fixtures.contains_key(f.0))
                .map(|f| f.1.to_owned())
                .collect(),
        }
    }
}

#[derive(Debug, Copy, Clone)]
pub enum SyncType {
    Dry,
    Real,
}

pub async fn sync(
    team: Team,
    spond_creds: &spond::UserCredentials,
    spond_group_id: spond::GroupId,
    sync_type: SyncType,
) -> Result<(), Box<dyn std::error::Error>> {
    let full_times_fixtures = full_time::get_upcoming_fixtures(
        team.current_full_time_season_id(),
        &team.to_full_time_team(),
    )
    .await?;

    let spond_session = spond::login(&spond_creds).await?;
    let spond_group = spond::get_group(&spond_group_id, &spond_session).await?;
    let spond_sub_group_id = team.to_spond_sub_group_id();
    let mut spond_fixtures =
        spond::get_upcoming_matches(&spond_group_id, &spond_sub_group_id, &spond_session).await?;
    spond_fixtures.sort_by_key(|f| f.start_timestamp);
    let diff = Diff::new(full_times_fixtures, spond_fixtures);

    match sync_type {
        SyncType::Dry => {
            println!("Fixture diff for {}:", team);
            println!(
                "Summary\nNew: {:#?}\nModified: {:#?}\nRemoved: {:#?}\n",
                diff.new.len(),
                diff.modified.len(),
                diff.removed.len()
            );
        }
        SyncType::Real => {
            println!("Creating {} new fixtures for {}", diff.new.len(), team);
            for fixture in diff.new.iter() {
                println!("{:?}", fixture);
                let spond = fixture.to_create_spond_request(&spond_group, &spond_sub_group_id);
                spond::create_spond(spond, &spond_session).await?;
            }

            println!(
                "Updating {} modified fixtures for {}",
                diff.modified.len(),
                team
            );
            for (fixture, spond_fixture) in diff.modified.iter() {
                println!("{:?}", fixture);
                spond::update_spond(
                    spond_fixture.modify(&fixture, &spond_group, &spond_sub_group_id),
                    &spond_session,
                )
                .await?;
            }

            println!(
                "Deleting {} removed fixtures for {}",
                diff.removed.len(),
                team
            );
            for spond in diff.removed.iter() {
                spond::delete_spond(&spond.id, &spond_session).await?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    mod fixtures_diff {
        use super::*;

        mod new {
            use super::*;
            use chrono::{TimeZone, Utc};

            #[test]
            fn same_fixture_list_produces_no_diff() {
                let fixtures = vec![];
                let sponds = vec![];
                let diff = Diff::new(fixtures, sponds);
                assert!(
                    diff == Diff {
                        new: vec!(),
                        modified: vec!(),
                        removed: vec!()
                    }
                )
            }

            // #[test]
            // fn is_symmetrical() {
            //     let fixtures = vec![full_time::Fixture {
            //         typ: full_time::FixtureType::Cup,
            //         side: full_time::FixtureSide::Away,
            //         date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 5, 0).unwrap(),
            //         opposition: "Opponent".to_string(),
            //     }];
            //     let sponds = vec![];
            //     let diff = Diff::new(fixtures.clone(), fixtures.clone());
            //     let reverse_diff = Diff::new(fixtures, fixtures);
            //     assert!(
            //         diff == Diff {
            //             new: reverse_diff.removed,
            //             modified: reverse_diff.modified,
            //             removed: reverse_diff.new
            //         }
            //     )
            // }

            // #[test]
            // fn considers_different_instances_on_the_same_date_as_modifications() {
            //     let fixture = full_time::Fixture {
            //         typ: full_time::FixtureType::Cup,
            //         side: full_time::FixtureSide::Away,
            //         date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 5, 0).unwrap(),
            //         opposition: "Opponent".to_string(),
            //     };
            //     let modified = full_time::Fixture {
            //         date_time: Utc.with_ymd_and_hms(2023, 1, 1, 10, 10, 0).unwrap(),
            //         ..fixture.clone()
            //     };
            //     let fixtures = vec![fixture];
            //     let sponds = vec![modified.clone()];
            //     let diff = Diff::new(fixtures.clone(), sponds.clone());
            //     assert!(
            //         diff == Diff {
            //             new: vec![],
            //             modified: vec![modified],
            //             removed: vec![]
            //         }
            //     )
            // }
        }
    }
}
