# swagger-testcheck

Generates [testcheck.js](https://github.com/leebyron/testcheck-js) generators from a swagger definition. It _only_ looks at the `definitions` field in the swagger definition, and creates one generator per definition. For nested definitions (using `$ref`), the generators are duplicated - this is because `$ref` can point to other files.

## Usage

* `npm i -g swagger-testcheck`
* `swagger-testcheck api-definition.yaml`

The command will write the generated javascript to `stdout`, to save it to a file run `swagger-testcheck api.yaml >> generators.js`.
