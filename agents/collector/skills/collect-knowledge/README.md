# collect-knowledge

TypeScript execution layer for the OpenClaw `collect-knowledge` Skill. It invokes the existing deterministic Python collector with an argument array rather than a shell command.

## Input

`CollectionInput` supports `text`, `file`, and `webpage`. Webpage input rejects obvious loopback and private addresses before the Python collector performs DNS-level SSRF validation.

## Output

`collectKnowledge()` returns a normalized `CollectedKnowledge` object or throws a traceable error. Runtime values such as script path, timeout, and output limit are stored in `config.json`.
