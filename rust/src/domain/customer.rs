use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::event::DomainEvent;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Active,
    Deactivated,
}

impl Status {
    pub fn as_str(&self) -> &'static str {
        match self { Status::Active => "ACTIVE", Status::Deactivated => "DEACTIVATED" }
    }
    pub fn from_str(s: &str) -> Option<Self> {
        match s { "ACTIVE" => Some(Self::Active), "DEACTIVATED" => Some(Self::Deactivated), _ => None }
    }
}

#[derive(Debug, Clone)]
pub struct Customer {
    id: Uuid,
    name: String,
    email: String,
    status: Status,
    order_count: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    version: i32,
    events: Vec<DomainEvent>,
}

impl Customer {
    pub fn new(name: impl Into<String>, email: impl Into<String>) -> DomainResult<Self> {
        let name = name.into();
        if name.trim().len() < 2 { return Err(DomainError::InvalidName); }

        let email = email.into().trim().to_lowercase();
        if !email.contains('@') || !email.contains('.') {
            return Err(DomainError::InvalidEmail(email));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let mut c = Self {
            id, name: name.trim().to_string(), email: email.clone(),
            status: Status::Active, order_count: 0,
            created_at: now, updated_at: now, version: 0,
            events: Vec::new(),
        };
        c.events.push(
            DomainEvent::new("customer.registered", id.to_string())
                .with("email", &email).with("name", &c.name),
        );
        Ok(c)
    }

    pub fn reconstitute(
        id: Uuid, name: String, email: String, status: Status,
        order_count: i32, created_at: DateTime<Utc>, updated_at: DateTime<Utc>, version: i32,
    ) -> Self {
        Self { id, name, email, status, order_count, created_at, updated_at, version, events: Vec::new() }
    }

    pub fn id(&self) -> Uuid { self.id }
    pub fn name(&self) -> &str { &self.name }
    pub fn email(&self) -> &str { &self.email }
    pub fn status(&self) -> Status { self.status }
    pub fn order_count(&self) -> i32 { self.order_count }
    pub fn is_active(&self) -> bool { self.status == Status::Active }
    pub fn created_at(&self) -> DateTime<Utc> { self.created_at }
    pub fn updated_at(&self) -> DateTime<Utc> { self.updated_at }
    pub fn version(&self) -> i32 { self.version }
    pub fn drain_events(&mut self) -> Vec<DomainEvent> { std::mem::take(&mut self.events) }

    pub fn change_email(&mut self, new_email: impl Into<String>) -> DomainResult<()> {
        if !self.is_active() { return Err(DomainError::CustomerNotActive); }
        let new_email = new_email.into().trim().to_lowercase();
        if !new_email.contains('@') { return Err(DomainError::InvalidEmail(new_email)); }
        if self.email == new_email { return Ok(()); }
        let old = std::mem::replace(&mut self.email, new_email.clone());
        self.touch();
        self.events.push(
            DomainEvent::new("customer.email_changed", self.id.to_string())
                .with("old_email", &old).with("new_email", &new_email),
        );
        Ok(())
    }

    pub fn deactivate(&mut self, reason: &str) {
        if self.status == Status::Deactivated { return; }
        self.status = Status::Deactivated;
        self.touch();
        self.events.push(
            DomainEvent::new("customer.deactivated", self.id.to_string())
                .with("reason", reason),
        );
    }

    pub fn increment_order_count(&mut self) {
        self.order_count += 1;
        self.touch();
    }

    fn touch(&mut self) { self.updated_at = Utc::now(); self.version += 1; }
}

pub trait CustomerRepository: Send + Sync {
    fn find_by_id(&self, id: Uuid) -> impl std::future::Future<Output = anyhow::Result<Option<Customer>>> + Send;
    fn find_by_email(&self, email: &str) -> impl std::future::Future<Output = anyhow::Result<Option<Customer>>> + Send;
    fn save(&self, customer: &Customer) -> impl std::future::Future<Output = anyhow::Result<()>> + Send;
}
