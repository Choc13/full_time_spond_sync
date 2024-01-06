use chrono::{DateTime, Months, NaiveDate, Utc};
use full_time_spond_sync::{Fixture, FixtureSide, FixtureType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct UserCredentials {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UserSession {
    #[serde(rename = "loginToken")]
    login_token: String,
    #[serde(rename = "passwordToken")]
    password_token: String,
}

pub async fn login(credentials: &UserCredentials) -> reqwest::Result<UserSession> {
    let response = reqwest::Client::new()
        .post("https://api.spond.com/core/v1/login")
        .json(credentials)
        .send()
        .await?;

    match response.error_for_status() {
        Ok(res) => res.json().await,
        Err(e) => Err(e),
    }
}

#[derive(Debug)]
enum Order {
    Asc,
    Desc,
}

impl From<Order> for String {
    fn from(order: Order) -> Self {
        match order {
            Order::Asc => "asc",
            Order::Desc => "desc",
        }
        .to_owned()
    }
}

#[derive(Debug)]
struct GetSpondsRequest {
    add_profile_info: bool,
    exclude_availability: bool,
    exclude_repeating: bool,
    group_id: Option<GroupId>,
    include_comments: bool,
    include_hidden: bool,
    mtch: bool,
    max: Option<u32>,
    order: Option<Order>,
    min_start_timestamp: Option<DateTime<Utc>>,
    max_start_timestamp: Option<DateTime<Utc>>,
    scheduled: bool,
    sub_group_id: Option<SubGroupId>,
}

#[derive(Debug, Serialize, Deserialize)]
enum SpondType {
    Event,
}

#[derive(Debug, Deserialize, Serialize)]
struct UserId(String);

#[derive(Debug, Deserialize)]
struct SpondId(String);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Response {
    Accepted,
    Declined,
}

#[derive(Debug, Deserialize)]
struct Owner {
    #[serde(rename = "id")]
    id: UserId,
    #[serde(rename = "response")]
    response: Response,
}

#[derive(Debug, Deserialize, Serialize)]
struct LocationId(String);

#[derive(Debug, Deserialize)]
struct Location {
    #[serde(rename = "id")]
    id: LocationId,
    #[serde(rename = "feature")]
    feature: String,
    #[serde(rename = "address")]
    address: String,
    #[serde(rename = "latitude")]
    latitude: f32,
    #[serde(rename = "longitude")]
    longitude: f32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
enum MatchType {
    Home,
    Away,
    Tournament,
}

#[derive(Debug, Deserialize, Serialize)]
struct MatchInfo {
    #[serde(rename = "teamName")]
    team_name: String,
    #[serde(rename = "opponentName")]
    opponent_name: String,
    #[serde(rename = "teamColour")]
    team_colour: Option<String>,
    #[serde(rename = "opponentColour")]
    opponent_colour: Option<String>,
    #[serde(rename = "type")]
    typ: MatchType,
    #[serde(rename = "scoresSet")]
    scores_set: bool,
    #[serde(rename = "scoresSetEver")]
    scores_set_ever: bool,
    #[serde(rename = "teamScore")]
    team_score: Option<u8>,
    #[serde(rename = "opponentScore")]
    opponent_score: Option<u8>,
    #[serde(rename = "scoresPublic")]
    scores_public: bool,
    #[serde(rename = "scoresFinal")]
    scores_final: bool,
}

impl MatchInfo {
    pub fn new(team_name: String, opponent_name: String, typ: MatchType) -> Self {
        Self {
            team_name,
            opponent_name,
            team_colour: None,
            opponent_colour: None,
            typ,
            scores_set: false,
            scores_set_ever: false,
            team_score: None,
            opponent_score: None,
            scores_public: true,
            scores_final: false,
        }
    }
}

#[derive(Debug, Deserialize)]
struct Spond {
    #[serde(rename = "id")]
    id: SpondId,
    #[serde(rename = "creatorId")]
    creator_id: SpondId,
    #[serde(rename = "owners")]
    owners: Vec<Owner>,
    #[serde(rename = "heading")]
    heading: String,
    #[serde(rename = "description")]
    description: String,
    #[serde(rename = "startTimestamp")]
    start_timestamp: DateTime<Utc>,
    #[serde(rename = "endTimestamp")]
    end_timestamp: DateTime<Utc>,
    #[serde(rename = "meetupTimestamp")]
    meetup_timestamp: DateTime<Utc>,
    #[serde(rename = "meetupPrior")]
    meetup_prior: u16,
    #[serde(rename = "location")]
    location: Option<Location>,
    #[serde(rename = "matchInfo")]
    match_info: Option<MatchInfo>,
    #[serde(rename = "matchEvent")]
    match_event: bool,
    #[serde(rename = "createdTime")]
    created_time: DateTime<Utc>,
    #[serde(rename = "expired")]
    expired: bool,
}

impl Spond {
    fn to_fixture(&self) -> Option<Fixture> {
        self.match_info.as_ref().map(|match_info| Fixture {
            fixture_type: match match_info.typ {
                MatchType::Tournament => FixtureType::Cup,
                MatchType::Home | MatchType::Away => FixtureType::League,
            },
            fixture_side: match match_info.typ {
                MatchType::Tournament | MatchType::Home => FixtureSide::Home,
                MatchType::Away => FixtureSide::Away,
            },
            date_time: self.start_timestamp,
            opposition: match_info.opponent_name.clone(),
        })
    }
}

async fn get_sponds(
    request: GetSpondsRequest,
    session: &UserSession,
) -> reqwest::Result<Vec<Spond>> {
    let response = reqwest::Client::new()
        .get("https://api.spond.com/core/v1/sponds")
        .query(
            &vec![
                Some(("addProfileInfo", request.add_profile_info.to_string())),
                Some((
                    "excludeAvailability",
                    request.exclude_availability.to_string(),
                )),
                Some(("excludeRepeating", request.exclude_repeating.to_string())),
                request.group_id.map(|id| ("groupId", id.0)),
                Some(("includeComments", request.include_comments.to_string())),
                Some(("includeHidden", request.include_hidden.to_string())),
                Some(("match", request.mtch.to_string())),
                request.max.map(|max| ("max", max.to_string())),
                request.order.map(|order| ("order", order.into())),
                request
                    .min_start_timestamp
                    .map(|dt| ("minStartTimestamp", dt.to_rfc3339())),
                request
                    .max_start_timestamp
                    .map(|dt| ("maxStartTimestamp", dt.to_rfc3339())),
                Some(("scheduled", request.scheduled.to_string())),
                request.sub_group_id.map(|id| ("subGroupId", id.0)),
            ]
            .iter()
            .filter_map(|x| x.clone())
            .collect::<Vec<_>>(),
        )
        .bearer_auth(session.login_token.clone())
        .send()
        .await?;
    match response.error_for_status() {
        Ok(res) => res.json().await,
        Err(e) => Err(e),
    }
}

#[derive(Debug, Serialize)]
enum Visibility {
    Invitees,
}

#[derive(Debug, Serialize)]
enum AutoReminderType {
    Disabled,
}

#[derive(Debug, Serialize)]
struct Attachment {}

#[derive(Debug, Serialize)]
enum Type {
    Event,
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupId(String);

impl GroupId {
    pub fn new(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SubGroupId(String);

impl SubGroupId {
    pub fn new(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Serialize)]
struct Group {
    id: GroupId,
    sub_groups: Vec<SubGroupId>,
}

#[derive(Debug, Serialize)]
struct Recipients {
    group_members: Vec<GroupId>,
    group: Group,
}

#[derive(Debug, Serialize)]
struct CreateSpondRequest {
    heading: String,
    spond_type: SpondType,
    start_time_stamp: DateTime<Utc>,
    open_ended: bool,
    comments_disabled: bool,
    max_accepted: u32,
    rsvp_date: Option<NaiveDate>,
    location: Option<LocationId>,
    owners: Vec<UserId>,
    visibility: Visibility,
    participants_hidden: bool,
    auto_reminder_type: AutoReminderType,
    match_info: Option<MatchInfo>,
    auto_accept: bool,
    attachments: Vec<Attachment>,
    typ: Type,
    recipients: Recipients,
}

async fn create_spond(request: CreateSpondRequest, session: &UserSession) -> reqwest::Result<()> {
    let response = reqwest::Client::new()
        .post("https://api.spond.com/core/v1/sponds")
        .json(&request)
        .bearer_auth(session.login_token.clone())
        .send()
        .await?;
    match response.error_for_status() {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn get_upcoming_fixtures(
    group_id: GroupId,
    sub_group_id: SubGroupId,
    session: &UserSession,
) -> Result<Vec<Fixture>, String> {
    get_sponds(
        GetSpondsRequest {
            add_profile_info: false,
            exclude_availability: true,
            exclude_repeating: true,
            include_comments: false,
            include_hidden: false,
            group_id: Some(group_id),
            mtch: true,
            min_start_timestamp: Some(Utc::now()),
            max_start_timestamp: None,
            scheduled: false,
            max: None,
            order: None,
            sub_group_id: Some(sub_group_id),
        },
        &session,
    )
    .await
    .map_err(|e| e.to_string())
    .map(|sponds| sponds.iter().filter_map(|s| s.to_fixture()).collect())
}

pub async fn create_fixtures(fixtures: &Vec<Fixture>, session: &UserSession) -> Result<(), String> {
    todo!()
}
