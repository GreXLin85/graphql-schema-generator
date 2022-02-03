import type {DMMF} from '@prisma/generator-helper';

import {DataModel} from './parse';
import {Definition, ReservedName, SDL} from './converters/types';

import addTypeModifiers from './converters/addTypeModifiers';
import convertType from './converters/convertType';
import extractScalars from './extractors/extractScalars';
import formatDefinition from './formatters/formatDefinition';
import formatField from './formatters/formatField';
import formatScalar from './formatters/formatScalar';

import {removeExclamation, removeParentheses, sdl} from './utils';

import type {Config} from './generateGraphqlSchema';

const getTypeConvertedFields = (
  model: DMMF.Model,
  config?: Config,
  isModelsOfSchema = false,
): DMMF.Field[] => {
  if (!model) {
    return [];
  }

  const shouldIgnore = model.fields.reduce(
    (acc: {[key: string]: boolean}, cur: DMMF.Field) => {
      const {relationFromFields} = cur;

      if (relationFromFields) {
        relationFromFields.forEach((field: string) => {
          acc[field] = true;
        });
      }

      return acc;
    },
    {},
  );
  const typeConvertedFields = model.fields.reduce(
    (collected: DMMF.Field[], field: DMMF.Field): DMMF.Field[] => {
      const {name} = field;

      if (shouldIgnore[name]) {
        return collected;
      }

      const applyCustomRulesBeforeTypeModifiersAddition = (
        f: DMMF.Field,
        m: DMMF.Model,
      ): DMMF.Field => {
        return convertType(f, m, config, isModelsOfSchema);
      };

      const applyCustomRulesAfterTypeModifiersAddition = (
        f: DMMF.Field,
        m: DMMF.Model,
      ): DMMF.Field => {
        return addTypeModifiers(f, m, config, isModelsOfSchema);
      };

      const transformers = [
        convertType,
        config?.customRules?.beforeAddingTypeModifiers &&
          applyCustomRulesBeforeTypeModifiersAddition,
        addTypeModifiers,
        config?.customRules?.afterAddingTypeModifiers &&
          applyCustomRulesAfterTypeModifiersAddition,
      ].filter(Boolean);

      try {
        const typeConvertedField = transformers.reduce((acc, transformer) => {
          return transformer!(acc, model, config, isModelsOfSchema);
        }, field);

        return [...collected, typeConvertedField];
      } catch (err) {
        return collected;
      }
    },
    [],
  );

  return typeConvertedFields;
};

const transpile = (dataModel: DataModel, config?: Config): string => {
  const {models, enums, names} = dataModel;

  const queryFields = dataModel.names.reduce((acc: string[], name) => {
    const modelFields = getTypeConvertedFields(models[name], config);

    const {name: idName} = modelFields.find(({type}) => {
      if (typeof type !== 'string') {
        return false;
      }

      return type.match(SDL.ID);
    }) ?? {name: 'id'};

    return [
      ...acc,
      `${name.toLowerCase()}(${idName}: ID!): ${name}`,
      `${name.toLowerCase()}s: [${name}!]!`,
    ];
  }, []);

  const queriesOfSchema = formatDefinition({
    type: Definition.type,
    name: ReservedName.Query,
    fields: queryFields,
  });

  const mutationFields = dataModel.names.reduce((acc: string[], name) => {
    const modelFields = getTypeConvertedFields(models[name], config);

    const {name: idName} = modelFields.find(({type}) => {
      if (typeof type !== 'string') {
        return false;
      }

      return type.match(SDL.ID);
    }) ?? {name: 'id'};

    return [
      ...acc,
      `create${name}(${name.toLowerCase()}: ${name}CreateInput!): ${name}`,
      `update${name}(${name.toLowerCase()}: ${name}UpdateInput!): ${name}`,
      `delete${name}(${idName}: ID!): ${name}`,
    ];
  }, []);

  const mutationInputs = dataModel.names.reduce(
    (inputs: string[], modelName) => {
      const modelFields = getTypeConvertedFields(models[modelName], config);

      const fieldsWithoutID = modelFields.reduce(
        (fields: DMMF.Field[], cur) => {
          const {type} = cur;

          if (typeof type === 'string' && type.match(SDL.ID)) {
            return fields;
          }

          return [...fields, cur];
        },
        [],
      );

      const createInputFields = fieldsWithoutID.map(
        ({name, type}) => `${name}: ${type}`,
      );

      const updateInputFields = fieldsWithoutID.map(
        ({name, type}) => `${name}: ${removeExclamation(type as string)}`,
      );

      return [
        ...inputs,
        formatDefinition({
          type: Definition.input,
          name: `${modelName}CreateInput`,
          fields: createInputFields,
        }) +
          formatDefinition({
            type: Definition.input,
            name: `${modelName}UpdateInput`,
            fields: updateInputFields,
          }),
      ];
    },
    [],
  );

  const mutation = formatDefinition({
    type: Definition.type,
    name: ReservedName.Mutation,
    fields: mutationFields,
  });

  const mutationsOfSchema = mutationInputs + mutation;
  let whereInputs: string[] = [];
  if (config?.argConfig?.models) {
    let enumInputs = '';
    whereInputs = dataModel.names.reduce((inputs: string[], modelName) => {
      if (!config.argConfig?.models?.includes(modelName)) {
        return inputs;
      }
      const NATIVE_TYPES = [
        'Int',
        'Float',
        'String',
        'BigInt',
        'Boolean',
        'Decimal',
        'DateTime',
        'ID',
      ];
      const modelFields = getTypeConvertedFields(models[modelName], config);
      const generateEnumInput = (field: DMMF.Field): string => {
        let {type} = field;
        type = removeExclamation(type as string);
        return `input Enum${type}Filter {
                  equals: ${type}
                  in: [${type}]
                  notIn: [${type}]
                  not: Enum${type}Filter
                }

        `;
      };
      const {nativeFields, relation, enumFields} = modelFields.reduce(
        (groups, cur) => {
          const {type} = cur;
          if (NATIVE_TYPES.includes(removeExclamation(type as string))) {
            return {
              ...groups,
              nativeFields: [...groups.nativeFields, cur],
            };
          }
          if (cur.kind === 'enum') {
            return {
              ...groups,
              enumFields: [...groups.enumFields, cur],
            };
          }
          if (cur.kind === 'object') {
            return {
              ...groups,
              relation: [...groups.relation, cur],
            };
          }

          return groups;
        },
        {nativeFields: [], enumFields: [], relation: []} as {
          nativeFields: DMMF.Field[];
          enumFields: DMMF.Field[];
          relation: DMMF.Field[];
        },
      );
      const filters = {
        ID: 'StringFilter',
        Int: 'IntFilter',
        Float: 'IntFilter',
        String: 'StringFilter',
        Boolean: 'BooleanFilter',
        Decimal: 'IntFilter',
        DateTime: 'DateTimeFilter',
      };
      const inputFields = nativeFields.map(
        ({name, type}) =>
          `${name}: ${filters[removeExclamation(type as string)]}`,
      );

      if (enumFields.length) {
        enumFields.forEach((field) => {
          const enumType = `Enum${removeExclamation(
            field.type as string,
          )}Filter`;
          if (!enumInputs.includes(enumType)) {
            enumInputs += generateEnumInput(field);
          }
          inputFields.push(`${field.name}: ${enumType}`);
        });
      }

      return [
        ...inputs,

        formatDefinition({
          type: Definition.input,
          name: `${modelName}WhereInput`,
          fields: inputFields,
        }),
      ];
    }, []);
    whereInputs = [...whereInputs, enumInputs].filter(Boolean);
  }
  const scalars = extractScalars(dataModel);

  const scalarsOfSchema = scalars
    .map((scalar) => formatScalar(scalar))
    .join('');

  const enumsOfSchema = Object.entries(enums)
    .map(([name, anEnum]) => {
      const fields = anEnum.map(({name: field}) => `\t${field}`);

      return formatDefinition({
        type: Definition.enum,
        name,
        fields,
      });
    })
    .join('');
  const countTypes: string[] = [];
  const modelsOfSchema = names
    .map((name) => {
      let listFields: string[] = [];
      const fields = getTypeConvertedFields(models[name], config, true).map(
        (field) => {
          if (field.isList) {
            listFields.push(removeParentheses(field.name));
          }
          return formatField(field);
        },
      );
      if (listFields.length) {
        let cleanName = removeParentheses(name);
        let _countType = `type ${cleanName}Count\t{\n\t${listFields.join(
          ': Int\n\t',
        )}: Int\n}\n`;
        countTypes.push(_countType);
        fields.push(`_count: ${cleanName}Count`);
      }

      return formatDefinition({
        type: Definition.type,
        name,
        fields,
      });
    })
    .join('');

  const schema =
    whereInputs +
    (config?.createQuery === 'true' ? queriesOfSchema : '') +
    (config?.createMutation === 'true' ? mutationsOfSchema : '') +
    scalarsOfSchema +
    enumsOfSchema +
    modelsOfSchema +
    countTypes;
  return sdl(schema, !!config?.ignoreWhereFilters);
};

export default transpile;
