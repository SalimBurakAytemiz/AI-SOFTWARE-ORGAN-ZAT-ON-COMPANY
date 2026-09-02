# Project Factory Proof - Intake Assumptions

Fields Project Factory inferred or defaulted from the brief. Correct any of
these by editing project.yml before authorizing the build.

- project_type = api_service (matched /\b(api service|rest api|graphql api|microservice|backend service|web service|\/health)\b/)
- business_model = other (no explicit business model in the brief)
- platforms = [api] (detected: api)
- target_market = unspecified (no target market/region named in the brief)
- target_users = [end users] (no users stated; defaulted to 'end users' from business model 'other')
- risk_level = 2 (heuristic from the brief; floor 2 for any real feature work)
- security_level = standard (no elevated-security signal in the brief)
- core_features: 1 item(s) (extracted from action sentences in the brief)
- business_goal synthesised from the project name and target users
