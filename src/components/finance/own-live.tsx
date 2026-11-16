import {CurrentFinanceOverview} from './current-overview';
/** Earlier records remain stored; active financial pages use owned cohorts only. */
export function OwnLivePage(props:{initialView?:string;title?:string}){return <CurrentFinanceOverview {...props}/>;}
