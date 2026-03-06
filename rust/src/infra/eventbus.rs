use tracing::{debug, error};
use crate::app::EventPublisher;
use crate::domain::event::DomainEvent;

/// In-memory event publisher. Swap for NATS/Kafka in production.
pub struct LogEventBus;

impl EventPublisher for LogEventBus {
    async fn publish(&self, events: Vec<DomainEvent>) {
        for event in &events {
            debug!(
                event_type = %event.event_type,
                aggregate_id = %event.aggregate_id,
                event_id = %event.id,
                "domain event published"
            );
        }
    }
}
