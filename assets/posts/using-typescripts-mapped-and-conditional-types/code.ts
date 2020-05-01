import {
  ArraySchema,
  BooleanSchema,
  NumberSchema,
  StringSchema,
  SymbolSchema,
} from '@hapi/joi'
import * as joi from '@hapi/joi'

type PropertySchema<PropertyType> =
  PropertyType extends boolean ? BooleanSchema :
  PropertyType extends string ? StringSchema :
  PropertyType extends number ? NumberSchema :
  PropertyType extends symbol ? SymbolSchema :
  PropertyType extends ArrayLike<any> ? ArraySchema :
  PropertyType extends Record<string, any> ? Validation<PropertyType> :
  never

type Validation<T extends Record<string, any>> = {
  [PropertyName in keyof T]-?: PropertySchema<T[PropertyName]>
}

// Define type to demonstrate compilation errors
type Article = {
  title: string
  content: string
  author: {
    name: string
  }
}

// Fails, does not define "author"
const WrongSchema1: Validation<Article> = {
  title: joi.string(),
  content: joi.string(),
}

// Fails, defines wrong schema for "author"
const WrongSchema2: Validation<Article> = {
  title: joi.string(),
  content: joi.string(),
  author: joi.number(),
}

// Succeeds
const CorrectSchema: Validation<Article> = {
  title: joi.string(),
  content: joi.string(),
  author: {
    name: joi.string(),
  },
}
