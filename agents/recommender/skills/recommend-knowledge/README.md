# recommend-knowledge

Loads existing knowledge candidates and ranks them using deterministic Jaccard similarity over normalized tags. Excluded IDs are removed before scoring, ties are stable, and every result includes matched tags as its recommendation reason.

The implementation is a content-based baseline. Collaborative filtering can be added after user interaction history is available.
