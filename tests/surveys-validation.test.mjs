import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/surveys.js";

const origin = "https://hilafood.pages.dev";
test("invalid and unknown survey actions are rejected", async () => {
  const request = new Request(origin + "/api/surveys", { method:"POST", headers:{Origin:origin,"Content-Type":"application/json"}, body:JSON.stringify({action:"surprise"}) });
  const response = await onRequestPost({request,env:{ADMIN_KEY:"x",DB:{prepare(){return {first:async()=>null,all:async()=>({results:[]}),run:async()=>({meta:{last_row_id:1}}),bind(){return this}}}}}});
  assert.equal(response.status,400);
});
test("unrecognized question type cannot be saved", async () => {
  const request = new Request(origin + "/api/surveys", { method:"POST", headers:{Origin:origin,"Content-Type":"application/json","x-admin-key":"x"}, body:JSON.stringify({action:"admin-save",title:"نظرسنجی",questions:[{prompt:"سؤال",type:"hack",options:[]}]}) });
  const response = await onRequestPost({request,env:{ADMIN_KEY:"x",DB:{prepare(){return {first:async()=>null,all:async()=>({results:[]}),run:async()=>({meta:{last_row_id:1}}),bind(){return this}}}}}});
  assert.equal(response.status,400);
});
