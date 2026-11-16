import {describe,it,expect} from 'vitest';
import {addDays,funnelCounts,requiredEnquiries} from './funnel';
import type {Lead} from './plan';
describe('manual sales funnel',()=>{
 it('leaves enquiry requirement unknown until conversion is supplied',()=>{expect(requiredEnquiries(4)).toBeNull();expect(requiredEnquiries(4,.2)).toBe(20);expect(()=>requiredEnquiries(4,0)).toThrow();});
 it('uses calendar dates for the nurturing target, not automatic conversion',()=>{expect(addDays('2026-12-28',7)).toBe('2027-01-04');const lead:Lead={id:'1',reference:'A',firstContact:'2026-12-28',stage:'nurturing',nextFollowUp:'2027-01-04',notes:'',history:[]};expect(funnelCounts([lead],'2027-01-20').stages.paid).toBe(0);});
 it('reports mature cohort size and separately dated payment lag',()=>{const leads:Lead[]=[{id:'1',reference:'A',firstContact:'2026-11-01',stage:'paid',paidDate:'2026-11-10',nextFollowUp:'',notes:'',history:[]},{id:'2',reference:'B',firstContact:'2026-11-15',stage:'enquiry',nextFollowUp:'2026-11-22',notes:'',history:[]}];const c=funnelCounts(leads,'2026-11-20');expect(c.matureLeads).toBe(1);expect(c.matureConversion).toBe(1);expect(c.averageLag).toBe(9);expect(c.stages.enquiry).toBe(1);});
});
