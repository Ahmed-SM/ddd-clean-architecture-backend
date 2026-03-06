/// Domain events — immutable facts about things that happened.
///
/// Rust idiom: events are plain `Clone` + `Debug` structs.
/// No trait objects, no dynamic dispatch — just data.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    pub id: Uuid,
    pub event_type: String,
    pub aggregate_id: String,
    pub occurred_at: DateTime<Utc>,
    pub payload: HashMap<String, serde_json::Value>,
}

impl DomainEvent {
    pub fn new(event_type: impl Into<String>, aggregate_id: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            event_type: event_type.into(),
            aggregate_id: aggregate_id.into(),
            occurred_at: Utc::now(),
            payload: HashMap::new(),
        }
    }

    /// Builder-style method for adding payload data.
    pub fn with(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        self.payload.insert(
            key.into(),
            serde_json::to_value(value).unwrap_or_default(),
        );
        self
    }
}
