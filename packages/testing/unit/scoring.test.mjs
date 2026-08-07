import {describe,it,expect} from 'vitest';
import {grade,siteWrightScore,scoreLead,resolveType,slugify} from './scoring.mjs';
describe('grade',()=>it('ranges',()=>{expect(grade(95)).toBe('A');expect(grade(20)).toBe('F');}));
describe('siteWrightScore',()=>{it('perfect',()=>expect(siteWrightScore({mobile:{performance:100,seo:100,accessibility:100,bestPractices:100},headers:{reachable:true,https:true,missing:[]}})).toBe(100));it('bad',()=>expect(siteWrightScore({mobile:{},headers:{reachable:false,https:false,missing:['a','b','c','d','e']}})).toBeLessThan(15));});
describe('scoreLead',()=>{it('HOT',()=>expect(scoreLead({userRatingCount:150,rating:4.6},null).priority).toBe('HOT'));it('bad>good',()=>expect(scoreLead({websiteUri:'x',userRatingCount:50},{siteWrightScore:20,https:false}).opportunityScore).toBeGreaterThan(scoreLead({websiteUri:'x',userRatingCount:50},{siteWrightScore:95,https:true}).opportunityScore));});
describe('resolveType',()=>it('classifies',()=>{expect(resolveType('Best Pizza')).toBe('restaurant');expect(resolveType('x')).toBe('default');}));
describe('slugify',()=>it('kebab',()=>expect(slugify("Joe's Plumbing")).toBe('joe-s-plumbing')));
