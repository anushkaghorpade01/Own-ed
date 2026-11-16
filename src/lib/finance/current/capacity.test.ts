import {describe,it,expect} from 'vitest';
import {checkFixedTimetable} from './capacity';
const base={memberBookingsBySlot:[25,25,25,25],dropBookingsBySlot:[2,2,2,2],privateBookings:12,planningFill:.92,memberSeatShare:.9};
describe('fixed popular-time timetable',()=>{
 it('keeps four group slots plus two private, without inventing midday groups',()=>{const r=checkFixedTimetable(base);expect(r.groupWeeklyPhysicalSeats).toBe(144);expect(r.privateWeeklySlots).toBe(12);expect(r.slots).toHaveLength(4);expect(r.slots.every(s=>!s.planningBreach)).toBe(true);});
 it('finds a slot overload that total weekly average hides',()=>{const r=checkFixedTimetable({...base,memberBookingsBySlot:[38,20,20,20]});expect(r.slots[0].physicalBreach).toBe(true);expect(r.slots[1].physicalBreach).toBe(false);});
 it('refuses to invent an equal demand split or assumed private bookings',()=>{const r=checkFixedTimetable({...base,memberBookingsBySlot:null,privateBookings:null});expect(r.verifiable).toBe(false);expect(r.slots[0].planningBreach).toBeNull();expect(r.privateBreach).toBeNull();});
 it('separates planning reservation from physical capacity',()=>{const r=checkFixedTimetable({...base,memberBookingsBySlot:[31,25,25,25],dropBookingsBySlot:[0,0,0,0]});expect(r.slots[0].memberShareBreach).toBe(true);expect(r.slots[0].physicalBreach).toBe(false);});
});
