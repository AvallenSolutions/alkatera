import { describe, it, expect } from 'vitest'
import {
  domainFromEmail,
  isConsumerDomain,
  candidateWebsite,
  provisionalNameFromDomain,
  guessFromEmail,
} from '../domain'
import {
  yearFromDate,
  mapSearchItem,
  mapCompanyProfile,
  pickBestMatch,
  type CompaniesHouseMatch,
} from '../companies-house'

describe('domainFromEmail', () => {
  it('extracts a lowercased domain', () => {
    expect(domainFromEmail('Camille@AvallenSpirits.com')).toBe('avallenspirits.com')
  })
  it('rejects non-addresses', () => {
    expect(domainFromEmail('not-an-email')).toBeNull()
    expect(domainFromEmail('a@b@c.com')).toBeNull()
    expect(domainFromEmail('a@localhost')).toBeNull()
    expect(domainFromEmail('a@.com')).toBeNull()
    expect(domainFromEmail('a@com.')).toBeNull()
  })
})

describe('isConsumerDomain', () => {
  it('flags free mailboxes', () => {
    expect(isConsumerDomain('gmail.com')).toBe(true)
    expect(isConsumerDomain('YAHOO.CO.UK')).toBe(true)
    expect(isConsumerDomain('proton.me')).toBe(true)
  })
  it('passes company domains through', () => {
    expect(isConsumerDomain('avallenspirits.com')).toBe(false)
  })
})

describe('candidateWebsite', () => {
  it('builds an https url for a company domain', () => {
    expect(candidateWebsite('avallenspirits.com')).toBe('https://avallenspirits.com')
  })
  it('refuses to guess a site for a consumer domain', () => {
    expect(candidateWebsite('gmail.com')).toBeNull()
  })
})

describe('provisionalNameFromDomain', () => {
  it('titlecases the second-level label', () => {
    expect(provisionalNameFromDomain('avallenspirits.com')).toBe('Avallenspirits')
  })
  it('splits hyphens and underscores into words', () => {
    expect(provisionalNameFromDomain('orchard-bay.co.uk')).toBe('Orchard Bay')
    expect(provisionalNameFromDomain('two_towns_cider.com')).toBe('Two Towns Cider')
  })
  it('returns null for consumer domains', () => {
    expect(provisionalNameFromDomain('hotmail.com')).toBeNull()
  })
})

describe('guessFromEmail', () => {
  it('produces a full guess for a work email', () => {
    expect(guessFromEmail('camille@avallenspirits.com')).toEqual({
      domain: 'avallenspirits.com',
      website: 'https://avallenspirits.com',
      provisionalName: 'Avallenspirits',
      isConsumer: false,
    })
  })
  it('produces an empty-but-marked guess for a consumer email', () => {
    expect(guessFromEmail('someone@gmail.com')).toEqual({
      domain: 'gmail.com',
      website: null,
      provisionalName: null,
      isConsumer: true,
    })
  })
  it('returns null for junk', () => {
    expect(guessFromEmail('nope')).toBeNull()
  })
})

describe('yearFromDate', () => {
  it('reads the year from an ISO date', () => {
    expect(yearFromDate('2018-05-14')).toBe(2018)
  })
  it('is null for anything else', () => {
    expect(yearFromDate('2018')).toBeNull()
    expect(yearFromDate(2018)).toBeNull()
    expect(yearFromDate(null)).toBeNull()
    expect(yearFromDate(undefined)).toBeNull()
  })
})

describe('mapSearchItem', () => {
  it('maps a well-formed item', () => {
    expect(
      mapSearchItem({
        company_number: '11298750',
        title: 'AVALLEN SPIRITS LTD',
        date_of_creation: '2018-05-14',
        company_status: 'active',
        address_snippet: '12 Somewhere St, London',
      }),
    ).toEqual({
      companyNumber: '11298750',
      name: 'AVALLEN SPIRITS LTD',
      incorporationYear: 2018,
      status: 'active',
      addressSnippet: '12 Somewhere St, London',
    })
  })
  it('rejects items missing a number or title', () => {
    expect(mapSearchItem({ title: 'No Number Ltd' })).toBeNull()
    expect(mapSearchItem({ company_number: '123' })).toBeNull()
    expect(mapSearchItem(null)).toBeNull()
  })
})

describe('mapCompanyProfile', () => {
  it('maps identity plus registered address', () => {
    expect(
      mapCompanyProfile({
        company_number: '11298750',
        company_name: 'AVALLEN SPIRITS LTD',
        date_of_creation: '2018-05-14',
        company_status: 'active',
        registered_office_address: {
          address_line_1: '12 Somewhere St',
          locality: 'London',
          postal_code: 'EC1 1AA',
          country: 'United Kingdom',
        },
      }),
    ).toEqual({
      companyNumber: '11298750',
      name: 'AVALLEN SPIRITS LTD',
      incorporationYear: 2018,
      status: 'active',
      registeredAddress: {
        line1: '12 Somewhere St',
        city: 'London',
        postalCode: 'EC1 1AA',
        country: 'United Kingdom',
      },
    })
  })
  it('tolerates a missing address block', () => {
    const p = mapCompanyProfile({ company_number: '1', company_name: 'X LTD' })
    expect(p?.registeredAddress).toEqual({ line1: null, city: null, postalCode: null, country: null })
  })
  it('is null without identity', () => {
    expect(mapCompanyProfile({ company_name: 'No Number Ltd' })).toBeNull()
    expect(mapCompanyProfile(null)).toBeNull()
  })
})

describe('pickBestMatch', () => {
  const m = (companyNumber: string, status: string | null): CompaniesHouseMatch => ({
    companyNumber, name: 'X', incorporationYear: null, status, addressSnippet: null,
  })
  it('prefers an active company', () => {
    expect(pickBestMatch([m('1', 'dissolved'), m('2', 'active')])?.companyNumber).toBe('2')
  })
  it('falls back to the first when none are active', () => {
    expect(pickBestMatch([m('1', 'dissolved'), m('2', 'liquidation')])?.companyNumber).toBe('1')
  })
  it('is null for an empty list', () => {
    expect(pickBestMatch([])).toBeNull()
  })
})
