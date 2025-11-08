use figment::{
    providers::{Format as _, Json},
    Figment,
};

#[derive(Debug, Clone)]
pub struct Spond {
    pub sub_group_id: crate::spond::SubGroupId,
}

#[derive(Debug, Clone)]
pub struct FullTime {
    pub season_id: crate::full_time::SeasonId,
    pub team: crate::full_time::Team,
}

#[derive(Debug, Clone)]
pub struct Team {
    pub name: String,
    pub full_time: FullTime,
    pub spond: Spond,
}

mod config {
    use serde::Deserialize;

    #[derive(Debug, Clone, Deserialize)]
    pub struct FullTime {
        id: i32,
        name: String,
        season_id: i32,
    }

    impl Into<super::FullTime> for FullTime {
        fn into(self) -> super::FullTime {
            super::FullTime {
                season_id: crate::full_time::SeasonId::new(self.season_id),
                team: crate::full_time::Team {
                    id: crate::full_time::TeamId::new(self.id),
                    name: crate::full_time::TeamName::new(self.name),
                },
            }
        }
    }

    #[derive(Debug, Clone, Deserialize)]
    pub struct Spond {
        sub_group_id: String,
    }

    impl Into<super::Spond> for Spond {
        fn into(self) -> super::Spond {
            super::Spond {
                sub_group_id: crate::spond::SubGroupId::new(self.sub_group_id),
            }
        }
    }

    #[derive(Debug, Clone, Deserialize)]
    pub struct Team {
        name: String,
        full_time: FullTime,
        spond: Spond,
    }

    impl Into<super::Team> for Team {
        fn into(self) -> super::Team {
            super::Team {
                name: self.name,
                full_time: self.full_time.into(),
                spond: self.spond.into(),
            }
        }
    }

    #[derive(Debug, Clone, Deserialize)]
    pub struct Teams {
        pub teams: Vec<Team>,
    }
}

pub fn load() -> figment::Result<Vec<Team>> {
    Ok(Figment::new()
        .join(Json::file("src/teams.json"))
        .extract::<config::Teams>()?
        .teams
        .into_iter()
        .map(|t| t.into())
        .collect())
}
