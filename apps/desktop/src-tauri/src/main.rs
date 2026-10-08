
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[cfg(not(target_os = "windows"))]
compile_error!("Flowforge native input currently supports Windows only.");
mod windows;
use std::{sync::{Arc,Mutex},time::{Duration,Instant}};
use enigo::{Enigo,Settings,Mouse,Keyboard,Key,Direction,Coordinate,Button};
use serde::{Deserialize,Serialize};
use base64::{Engine as _,engine::general_purpose::STANDARD};
use tauri::Manager;
use windows::{Rect,WindowInfo};
struct RunState { active:bool, session:u64, target:Option<(isize,u32)>, armed:Instant, heartbeat:Instant, enigo:Enigo, keys:Vec<Key>, buttons:Vec<Button> }
impl RunState {
 fn release(&mut self){for key in self.keys.drain(..){let _=self.enigo.key(key,Direction::Release);}for button in self.buttons.drain(..){let _=self.enigo.button(button,Direction::Release);}self.active=false;}
 fn guard(&mut self,session:u64,input:bool)->Result<Option<Rect>,String>{
  if !self.active||self.session!=session{return Err("Stopped".into())}
  if windows::f8_down(){self.release();return Err("Stopped with F8".into())}
  self.heartbeat=Instant::now();
  if let Some((hwnd,pid))=self.target {
   if !windows::valid(hwnd,pid){self.release();return Err("Target window closed or minimized".into())}
   if input||Instant::now()>=self.armed {if windows::foreground()!=hwnd {self.release();return Err("Target lost focus. Re-focus it and start again.".into())}}
   return windows::client_rect(hwnd).map(Some)
  }Ok(None)
 }
}
#[derive(Clone)]struct Native(Arc<Mutex<RunState>>);
#[derive(Deserialize)]
#[serde(tag="type",deny_unknown_fields)]
enum InputEvent {
 #[serde(rename="move")]Move{x:i32,y:i32,relative:bool,#[serde(default)]screen:bool},
 #[serde(rename="click")]Click{button:String},
 #[serde(rename="button")]Button{button:String,action:String},
 #[serde(rename="key")]Key{key:String,action:String,#[serde(rename="holdMs")]hold_ms:u32},
 #[serde(rename="text")]Text{value:String},
}
fn key(name:&str)->Result<Key,String>{Ok(match name {"Space"=>Key::Space,"Enter"=>Key::Return,"Tab"=>Key::Tab,"Escape"=>Key::Escape,"Shift"=>Key::Shift,"Control"=>Key::Control,"Alt"=>Key::Alt,"ArrowUp"=>Key::UpArrow,"ArrowDown"=>Key::DownArrow,"ArrowLeft"=>Key::LeftArrow,"ArrowRight"=>Key::RightArrow,s if s.len()==1&&s.chars().all(|c|c.is_ascii_alphanumeric())=>Key::Unicode(s.chars().next().unwrap()),_=>return Err("Unsupported key".into())})}
fn button(name:&str)->Result<Button,String>{match name{"left"=>Ok(Button::Left),"right"=>Ok(Button::Right),_=>Err("Unsupported mouse button".into())}}
fn direction(action:&str)->Result<Direction,String>{match action{"down"=>Ok(Direction::Press),"up"=>Ok(Direction::Release),_=>Err("Unsupported input direction".into())}}
fn lock(n:&Native)->Result<std::sync::MutexGuard<'_,RunState>,String>{n.0.lock().map_err(|_|"Input state unavailable".into())}
#[tauri::command]fn list_windows()->Vec<WindowInfo>{windows::enumerate()}
#[tauri::command]fn begin(state:tauri::State<Native>,target:Option<String>)->Result<u64,String>{let mut s=lock(&state)?;if s.active{return Err("A flow is already running".into())}s.release();s.target=match target {Some(id)=>{let hwnd=id.parse::<isize>().map_err(|_|"Invalid target")?;let item=windows::enumerate().into_iter().find(|w|w.id==id).ok_or("Window unavailable")?;Some((hwnd,item.pid))},None=>None};s.session=s.session.wrapping_add(1);s.active=true;s.armed=Instant::now()+Duration::from_secs(3);s.heartbeat=Instant::now();Ok(s.session)}
#[tauri::command]fn check(state:tauri::State<Native>,session:u64)->Result<(),String>{lock(&state)?.guard(session,false).map(|_|())}
#[tauri::command]fn stop(state:tauri::State<Native>)->Result<(),String>{lock(&state)?.release();Ok(())}
#[tauri::command]fn input(state:tauri::State<Native>,session:u64,event:InputEvent)->Result<(),String>{
 let mut s=lock(&state)?;let rect=s.guard(session,true)?;
 // Releases are also handled by stop/watchdog; events never activate a background window.
 match event {
 InputEvent::Move{x,y,relative,screen}=>{
  if !(-32768..=32768).contains(&x)||!(-32768..=32768).contains(&y){return Err("Coordinates out of bounds".into())}
  let (px,py)=if relative{let (cx,cy)=s.enigo.location().map_err(|e|e.to_string())?;(cx+x,cy+y)}else if let Some(r)=rect{if !screen{(r.left+x,r.top+y)}else{(x,y)}}else{(x,y)};
  if let Some(r)=rect{if !r.contains(px,py){return Err("Mouse movement would leave the target window".into())}}
  s.enigo.move_mouse(px,py,Coordinate::Abs).map_err(|e|e.to_string())?;
 },
 InputEvent::Click{button:name}=>{let b=button(&name)?;if let Some(r)=rect{let(x,y)=s.enigo.location().map_err(|e|e.to_string())?;if !r.contains(x,y){return Err("Move the cursor inside the target window".into())}}s.enigo.button(b,Direction::Click).map_err(|e|e.to_string())?;},
 InputEvent::Button{button:name,action}=>{let b=button(&name)?;let d=direction(&action)?;if d==Direction::Press{if let Some(r)=rect{let(x,y)=s.enigo.location().map_err(|e|e.to_string())?;if !r.contains(x,y){return Err("Cursor outside target".into())}}s.buttons.push(b)}else{s.buttons.retain(|v|*v!=b)}s.enigo.button(b,d).map_err(|e|e.to_string())?;},
 InputEvent::Key{key:name,action,hold_ms}=>{if hold_ms>5000{return Err("Key hold too long".into())}let k=key(&name)?;let d=direction(&action)?;if d==Direction::Press{s.keys.push(k)}else{s.keys.retain(|v|*v!=k)}s.enigo.key(k,d).map_err(|e|e.to_string())?;}
 InputEvent::Text{value}=>{if value.is_empty()||value.chars().count()>1000||value.contains('\0'){return Err("Invalid text input".into())}s.enigo.text(&value).map_err(|e|e.to_string())?;}
 }Ok(())
}
#[derive(Serialize)]struct Position{x:i32,y:i32}
#[tauri::command]fn position(state:tauri::State<Native>,session:u64,screen:bool)->Result<Position,String>{let mut s=lock(&state)?;let rect=s.guard(session,true)?;let(mut x,mut y)=s.enigo.location().map_err(|e|e.to_string())?;if !screen{if let Some(r)=rect{x-=r.left;y-=r.top}}Ok(Position{x,y})}
#[derive(Serialize)]struct Frame {data:String,x:i32,y:i32}
#[tauri::command]fn capture(state:tauri::State<Native>,session:u64)->Result<Frame,String>{
 let rect=lock(&state)?.guard(session,true)?;
 let screen=screenshots::Screen::from_point(rect.map(|r|r.left).unwrap_or(0),rect.map(|r|r.top).unwrap_or(0)).map_err(|e|e.to_string())?;
 let display=screen.display_info;
 // Explicit restriction avoids silently producing incorrect OCR click coordinates across monitors.
 if (display.scale_factor-1.0).abs()>0.01{return Err("Vision starter currently requires Windows display scaling set to 100%.".into())}
 let r=rect.unwrap_or(Rect{left:display.x,top:display.y,right:display.x+display.width as i32,bottom:display.y+display.height as i32});
 if r.left<display.x||r.top<display.y||r.right>display.x+display.width as i32||r.bottom>display.y+display.height as i32{return Err("Keep the target fully inside one display for vision blocks.".into())}
 let img=screen.capture_area(r.left-display.x,r.top-display.y,(r.right-r.left) as u32,(r.bottom-r.top) as u32).map_err(|e|e.to_string())?;
 let mut out=std::io::Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(img).write_to(&mut out,image::ImageOutputFormat::Png).map_err(|e|e.to_string())?;
 lock(&state)?.guard(session,true)?;
 Ok(Frame{data:format!("data:image/png;base64,{}",STANDARD.encode(out.into_inner())),x:r.left,y:r.top})
}
fn main(){
 tauri::Builder::default().setup(|app|{
  let enigo=Enigo::new(&Settings::default()).map_err(|e|std::io::Error::other(e.to_string()))?;
  let native=Native(Arc::new(Mutex::new(RunState{active:false,session:0,target:None,armed:Instant::now(),heartbeat:Instant::now(),enigo,keys:vec![],buttons:vec![]})));
  app.manage(native.clone());
  std::thread::spawn(move||loop{std::thread::sleep(Duration::from_millis(20));if let Ok(mut s)=native.0.lock(){if s.active&&(windows::f8_down()||s.heartbeat.elapsed()>Duration::from_secs(2)||s.target.map(|(h,p)|!windows::valid(h,p)||(Instant::now()>=s.armed&&windows::foreground()!=h)).unwrap_or(false)){s.release()}}});Ok(())
 }).invoke_handler(tauri::generate_handler![list_windows,begin,check,stop,input,capture,position]).on_window_event(|w,event|{if matches!(event,tauri::WindowEvent::CloseRequested{..}){if let Some(n)=w.try_state::<Native>(){if let Ok(mut s)=n.0.lock(){s.release()};}}}).run(tauri::generate_context!()).expect("Flowforge failed to start");
}
