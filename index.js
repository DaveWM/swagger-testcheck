#!/usr/bin/env node
"use strict";

const R = require('ramda');
const beautify = require('js-beautify').js_beautify;
const swaggerParser = require('swagger-parser');
const parseSwagger = R.bind(swaggerParser.validate, swaggerParser);

function markRequired(prop) {
    return R.ifElse(
        R.prop('properties'),
        R.assoc('properties', R.pipe(
            R.prop('properties'),
            R.toPairs,
            R.map(([k, v]) => [
                    k,
                    R.pipe(
                        R.assoc('isRequired', R.contains(k, prop.required || [])),
                        markRequired
                    )(v)
                ]
            ),
            R.fromPairs
        )(prop)),
        R.identity
    )(prop);
}

function propToTypescript(prop) {
    return R.pipe(
        R.cond([
            [R.prop('enum'), R.pipe(
                R.prop('enum'),
                R.map(JSON.stringify),
                R.join(', '),
                args => `gen.oneOf([${args}])`
            )],

            [
                R.propEq('type', 'string'),
                R.cond([
                    [R.either(R.propEq('format', 'date'), R.propEq('format', 'date-time')), R.always('dateGen')],
                    [R.always(true), R.always('gen.string')]
                ])
            ],

            [R.propEq('type', 'number'), R.ifElse(
                R.either(R.prop('minimum'), R.prop('maximum')),
                p => `gen.numberWithin(${p.minimum || Number.MAX_VALUE * -1}, ${p.maximum || Number.MAX_VALUE})`,
                R.always(`gen.number`)
            )],

            [R.propEq('type', 'integer'), R.ifElse(
                R.either(R.prop('minimum'), R.prop('maximum')),
                p => `gen.intWithin(${p.minimum || Number.MAX_SAFE_INTEGER * -1}, ${p.maximum || Number.MAX_SAFE_INTEGER})`,
                R.always(`gen.int`)
            )],

            [R.propEq('type', 'object'), R.pipe(
                R.prop('properties'),
                R.toPairs,
                R.map(([k, v]) => `"${k}": ${propToTypescript(v)}`),
                R.join(', '),
                props => `gen.object({ ${props} })`
            )],

            [R.propEq('type', 'array'), R.pipe(
                R.prop('items'),
                R.when(
                    R.complement(R.prop('type')),
                    R.assoc('type', 'object')
                ),
                R.assoc('isRequired', true),
                propToTypescript,
                ts => `gen.array(${ts})`
            )]
        ]),
        R.when(
            R.always(!prop.isRequired),
            s => `opt(${s})`
        )
    )(prop);
}


const swaggerDefToTypescript = R.pipe(
    R.prop('definitions'),
    R.toPairs,
    R.map(([propName, prop]) => `export const ${propName}Generator = ${R.pipe(
        R.assoc('isRequired', true),
        markRequired, 
        propToTypescript
    )(prop)};`),
    R.join('\r\n\r\n')
);

R.pipeP(
    parseSwagger,
    R.pipe(
        swaggerDefToTypescript,
        ts => `
  import {gen} from 'testcheck';

  function opt(generator){
    return gen.oneOf([gen.undefined, generator]);
  }

  const dateGen = gen.posInt.then(i => new Date(i));

  ${ts}
`,
        beautify
    ),
    output => process.stdout.write(output, 'utf8')
)(process.argv[2]);
