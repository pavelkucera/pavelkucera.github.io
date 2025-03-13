.DEFAULT_GOAL := help
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z/_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


.PHONY: serve
serve: ## Serve locally on port $(port ?= 4000)
serve: port ?= 4000
serve:
	nix develop --command jekyll serve -P $(port) --drafts
