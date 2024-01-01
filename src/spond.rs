use full_time_spond_sync::Fixture;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TeamId(String);

impl TeamId {
    pub fn new(s: &str) -> Self {
        TeamId(s.to_string())
    }
}

pub async fn get_upcoming_fixtures(spond_team: &TeamId) -> Result<Vec<Fixture>, String> {
    todo!()
}

pub async fn create_fixtures(fixtures: Vec<Fixture>) -> Result<(), String> {
    todo!()
}
