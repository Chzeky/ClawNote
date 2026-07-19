import json
import re
import runpy
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class ProjectStructureTests(unittest.TestCase):
    EXPECTED_SKILLS = {
        "collector": "collect-knowledge",
        "organizer": "organize-knowledge",
        "graph": "build-knowledge-graph",
        "qa": "knowledge-qa",
        "recommender": "recommend-knowledge",
    }

    def test_agent_configuration_files_exist(self):
        for agent in ["steward", *self.EXPECTED_SKILLS]:
            workspace = PROJECT_ROOT / "agents" / agent
            self.assertTrue((workspace / "SOUL.md").is_file(), agent)
            self.assertTrue((workspace / "AGENTS.md").is_file(), agent)

    def test_skill_frontmatter_and_folder_names_match(self):
        for agent, skill_name in self.EXPECTED_SKILLS.items():
            path = PROJECT_ROOT / "agents" / agent / "skills" / skill_name / "SKILL.md"
            content = path.read_text(encoding="utf-8")
            self.assertTrue(content.startswith("---\n"), str(path))
            self.assertRegex(content, rf"(?m)^name:\s*{re.escape(skill_name)}$")
            self.assertRegex(content, r"(?m)^description:\s*.+$")

    def test_skill_typescript_contract_files_exist(self):
        required_files = {
            "SKILL.md",
            "index.ts",
            "types.ts",
            "utils.ts",
            "config.json",
            "README.md",
        }
        for agent, skill_name in self.EXPECTED_SKILLS.items():
            skill_dir = PROJECT_ROOT / "agents" / agent / "skills" / skill_name
            existing_files = {path.name for path in skill_dir.iterdir() if path.is_file()}
            self.assertTrue(required_files.issubset(existing_files), str(skill_dir))
            with (skill_dir / "config.json").open(encoding="utf-8") as handle:
                json.load(handle)

    def test_submission_configs_are_valid_json(self):
        for filename in ["config.json", "permissions.json"]:
            with (PROJECT_ROOT / filename).open(encoding="utf-8") as handle:
                json.load(handle)

    def test_repository_has_no_user_specific_home_paths(self):
        checked_suffixes = {".md", ".json", ".py", ".sql", ".ts"}
        forbidden_path = "/" + "home" + "/" + "czk" + "/"
        for path in PROJECT_ROOT.rglob("*"):
            if not path.is_file() or path.suffix not in checked_suffixes:
                continue
            if any(part in {".git", ".venv", "node_modules"} for part in path.parts) or any(
                part.startswith("skills_backup_") for part in path.parts
            ):
                continue
            content = path.read_text(encoding="utf-8")
            self.assertNotIn(forbidden_path, content, str(path))

    def test_openclaw_setup_script_copies_only_safe_agent_payload(self):
        script_globals = runpy.run_path(str(PROJECT_ROOT / "scripts" / "setup_openclaw_local.py"))
        safe_files = set(script_globals["SAFE_AGENT_FILES"])
        runtime_names = set(script_globals["RUNTIME_NAMES"])

        self.assertEqual({"AGENTS.md", "SOUL.md", "IDENTITY.md"}, safe_files)
        for unsafe_name in {
            "HEARTBEAT.md",
            "USER.md",
            "TOOLS.md",
            "MEMORY.md",
            "openclaw-workspace-state.json",
            "memory",
            "archive",
        }:
            self.assertIn(unsafe_name, runtime_names)


if __name__ == "__main__":
    unittest.main()
