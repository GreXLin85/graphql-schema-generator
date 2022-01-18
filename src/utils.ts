import {printSchema, buildSchema} from 'graphql';
import whereFilterTypedefs from './where-filters-typedef';

export const sdl = (s: string, ignoreWhereFilters = false): string =>
  printSchema(buildSchema(ignoreWhereFilters ? s : whereFilterTypedefs + s));

export const removeExclamation = (s: string): string => {
  if (s.match(/!$/)) {
    return s.slice(0, -1);
  }

  return s;
};

export const removeBracketsOrExclamations = (s: string): string => {
  return s.replace(/!|\[|\]/g, '');
};
