use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::full_time;

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
pub enum Order {
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

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct UserId(String);

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct UserProfile {
    #[serde(rename = "id")]
    pub id: UserId,
    #[serde(rename = "contactMethod")]
    pub contact_method: String,
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
    #[serde(rename = "email")]
    pub email: Option<String>,
    #[serde(rename = "phoneNumber")]
    pub phone_number: Option<String>,
    #[serde(rename = "unableToReach")]
    pub unable_to_reach: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct GuardianId(String);

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Guardian {
    #[serde(rename = "id")]
    pub id: GuardianId,
    #[serde(rename = "profile")]
    pub profile: Option<UserProfile>,
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    #[serde(rename = "email")]
    pub email: Option<String>,
    #[serde(rename = "phoneNumber")]
    pub phone_number: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct RoleId(String);

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Permission {
    Members,
    Admins,
    Settings,
    Events,
    Posts,
    Polls,
    Payments,
    Chat,
    Files,
    FundRaisers,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct Role {
    #[serde(rename = "id")]
    pub id: RoleId,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "permissions")]
    pub permissions: Vec<Permission>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct GroupMemberId(String);

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct GroupMember {
    #[serde(rename = "id")]
    pub id: GroupMemberId,
    #[serde(rename = "profile")]
    pub profile: Option<UserProfile>,
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    #[serde(rename = "createdTime")]
    pub created_time: DateTime<Utc>,
    #[serde(rename = "guardians")]
    pub guardians: Vec<Guardian>,
    #[serde(rename = "subGroups")]
    pub sub_groups: Vec<SubGroupId>,
    #[serde(rename = "respondent")]
    pub respondent: bool,
    #[serde(rename = "roles")]
    pub roles: Option<Vec<RoleId>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct SubGroupId(String);

impl SubGroupId {
    pub fn new(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct SubGroup {
    #[serde(rename = "id")]
    pub id: SubGroupId,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "color")]
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct GroupId(String);

impl GroupId {
    pub fn new(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Group {
    #[serde(rename = "id")]
    pub id: GroupId,
    #[serde(rename = "contactPerson")]
    pub contact_person: UserProfile,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "activity")]
    pub activity: String,
    #[serde(rename = "createdTime")]
    pub created_time: DateTime<Utc>,
    #[serde(rename = "members")]
    pub members: Vec<GroupMember>,
    #[serde(rename = "subGroups")]
    pub sub_groups: Vec<SubGroup>,
    #[serde(rename = "roles")]
    pub roles: Vec<Role>,
}

pub async fn get_group(group_id: &GroupId, session: &UserSession) -> reqwest::Result<Group> {
    let response = reqwest::Client::new()
        .get(format!(
            "https://api.spond.com/core/v1/group/{}",
            group_id.0
        ))
        .bearer_auth(session.login_token.clone())
        .send()
        .await?;
    match response.error_for_status() {
        Ok(res) => res.json().await,
        Err(e) => Err(e),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpondType {
    Event,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SpondId(String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Response {
    Accepted,
    Declined,
    Unanswered,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Owner {
    #[serde(rename = "id")]
    pub id: UserId,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct OwnerResponse {
    #[serde(rename = "id")]
    id: UserId,
    #[serde(rename = "response")]
    response: Response,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Location {
    #[serde(rename = "feature")]
    feature: String,
    #[serde(rename = "address")]
    address: String,
    #[serde(rename = "latitude")]
    latitude: Decimal,
    #[serde(rename = "longitude")]
    longitude: Decimal,
}

impl Location {
    const GOALS_NAME: &str = "Goals Reading";
    const WOODFORD_PARK_NAME: &str = "Woodford Park - 3G";

    pub fn to_full_time_venue(&self) -> full_time::Venue {
        match self.feature.as_str() {
            Self::GOALS_NAME => full_time::Venue::Goals,
            Self::WOODFORD_PARK_NAME => full_time::Venue::WoodfordPark,
            _ => panic!("Unknown location {}", self.feature),
        }
    }

    pub fn goals() -> Self {
        Self {
            feature: Location::GOALS_NAME.to_owned(),
            address: "Woodlands Avenue, Woodley, Reading".to_owned(),
            latitude: rust_decimal_macros::dec!(51.453648),
            longitude: rust_decimal_macros::dec!(-0.9185121),
        }
    }

    pub fn woodford_park() -> Self {
        Self {
            feature: Location::WOODFORD_PARK_NAME.to_owned(),
            address: "Woodford Park Leisure Centre, Haddon Dr, Woodley, Reading, RG5 4LY"
                .to_owned(),
            latitude: rust_decimal_macros::dec!(51.457008),
            longitude: rust_decimal_macros::dec!(-0.9058048),
        }
    }

    pub fn from_full_time_venue(venue: full_time::Venue) -> Self {
        match venue {
            full_time::Venue::Goals => Self::goals(),
            full_time::Venue::WoodfordPark => Self::woodford_park(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MatchType {
    Home,
    Away,
    Tournament,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct MatchInfo {
    #[serde(rename = "teamName")]
    pub team_name: String,
    #[serde(rename = "opponentName")]
    pub opponent_name: String,
    #[serde(rename = "teamColour")]
    pub team_colour: Option<String>,
    #[serde(rename = "opponentColour")]
    pub opponent_colour: Option<String>,
    #[serde(rename = "type")]
    pub typ: MatchType,
    #[serde(rename = "scoresSet")]
    pub scores_set: bool,
    #[serde(rename = "scoresSetEver")]
    pub scores_set_ever: bool,
    #[serde(rename = "teamScore")]
    pub team_score: Option<u8>,
    #[serde(rename = "opponentScore")]
    pub opponent_score: Option<u8>,
    #[serde(rename = "scoresPublic")]
    pub scores_public: bool,
    #[serde(rename = "scoresFinal")]
    pub scores_final: bool,
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Spond {
    #[serde(rename = "id")]
    pub id: SpondId,
    #[serde(rename = "creatorId")]
    pub creator_id: SpondId,
    #[serde(rename = "owners")]
    pub owners: Vec<OwnerResponse>,
    #[serde(rename = "heading")]
    pub heading: String,
    #[serde(rename = "description")]
    pub description: Option<String>,
    #[serde(rename = "startTimestamp")]
    pub start_timestamp: DateTime<Utc>,
    #[serde(rename = "endTimestamp")]
    pub end_timestamp: DateTime<Utc>,
    #[serde(rename = "meetupTimestamp")]
    pub meetup_timestamp: Option<DateTime<Utc>>,
    #[serde(rename = "meetupPrior")]
    pub meetup_prior: Option<u16>,
    #[serde(rename = "location")]
    pub location: Option<Location>,
    #[serde(rename = "matchInfo")]
    pub match_info: Option<MatchInfo>,
    #[serde(rename = "matchEvent")]
    pub match_event: bool,
    #[serde(rename = "createdTime")]
    pub created_time: DateTime<Utc>,
    #[serde(rename = "expired")]
    pub expired: bool,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Visibility {
    Invitees,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AutoReminderType {
    Disabled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Attachment {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Type {
    Event,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecipientGroup {
    #[serde(rename = "id")]
    pub id: GroupId,
    #[serde(rename = "subGroups")]
    pub sub_groups: Vec<SubGroupId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Recipients {
    #[serde(rename = "groupMembers")]
    pub group_members: Vec<GroupMemberId>,
    #[serde(rename = "group")]
    pub group: RecipientGroup,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateSpondRequest {
    #[serde(rename = "heading")]
    pub heading: String,
    #[serde(rename = "spondType")]
    pub spond_type: SpondType,
    #[serde(rename = "startTimestamp")]
    pub start_timestamp: DateTime<Utc>,
    #[serde(rename = "endTimestamp")]
    pub end_timestamp: DateTime<Utc>,
    #[serde(rename = "openEnded")]
    pub open_ended: bool,
    #[serde(rename = "commentsDisabled")]
    pub comments_disabled: bool,
    #[serde(rename = "meetupPrior")]
    pub meetup_prior: Option<u16>,
    #[serde(rename = "maxAccepted")]
    pub max_accepted: u32,
    #[serde(rename = "rsvpDate")]
    pub rsvp_date: Option<NaiveDate>,
    #[serde(rename = "location")]
    pub location: Option<Location>,
    #[serde(rename = "owners")]
    pub owners: Vec<Owner>,
    #[serde(rename = "visibility")]
    pub visibility: Visibility,
    #[serde(rename = "participantsHidden")]
    pub participants_hidden: bool,
    #[serde(rename = "autoReminderType")]
    pub auto_reminder_type: AutoReminderType,
    #[serde(rename = "matchInfo")]
    pub match_info: Option<MatchInfo>,
    #[serde(rename = "autoAccept")]
    pub auto_accept: bool,
    #[serde(rename = "attachments")]
    pub attachments: Vec<Attachment>,
    #[serde(rename = "type")]
    pub typ: Type,
    #[serde(rename = "recipients")]
    pub recipients: Recipients,
}

pub async fn create_spond(
    request: CreateSpondRequest,
    session: &UserSession,
) -> reqwest::Result<()> {
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

pub async fn update_spond(spond: Spond, session: &UserSession) -> reqwest::Result<()> {
    let response = reqwest::Client::new()
        .post(format!(
            "https://api.spond.com/core/v1/sponds/{}",
            spond.id.0
        ))
        .json(&spond)
        .bearer_auth(session.login_token.clone())
        .send()
        .await?;
    match response.error_for_status() {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn delete_spond(id: &SpondId, session: &UserSession) -> reqwest::Result<()> {
    let response = reqwest::Client::new()
        .delete(format!("https://api.spond.com/core/v1/sponds/{}", id.0))
        .query(&[("quiet", "true")])
        .bearer_auth(session.login_token.clone())
        .send()
        .await?;
    match response.error_for_status() {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn get_upcoming_matches(
    group_id: &GroupId,
    sub_group_id: &SubGroupId,
    session: &UserSession,
) -> Result<Vec<Spond>, String> {
    get_sponds(
        GetSpondsRequest {
            add_profile_info: false,
            exclude_availability: true,
            exclude_repeating: true,
            include_comments: false,
            include_hidden: true,
            group_id: Some(group_id.clone()),
            mtch: true,
            min_start_timestamp: Some(Utc::now()),
            max_start_timestamp: None,
            scheduled: false,
            max: Some(100),
            order: Some(Order::Asc),
            sub_group_id: Some(sub_group_id.clone()),
        },
        &session,
    )
    .await
    .map_err(|e| e.to_string())
}
