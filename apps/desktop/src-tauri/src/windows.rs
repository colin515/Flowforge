
// Narrow Win32 FFI: enumeration, foreground identity, client bounds, emergency key.
use serde::Serialize;
#[repr(C)]#[derive(Clone,Copy,Default)]pub struct Rect{pub left:i32,pub top:i32,pub right:i32,pub bottom:i32}
impl Rect{pub fn contains(&self,x:i32,y:i32)->bool{x>=self.left&&x<self.right&&y>=self.top&&y<self.bottom}}
#[repr(C)]#[derive(Default)]struct Point{x:i32,y:i32}
#[link(name="user32")]
extern "system"{
 fn EnumWindows(callback:unsafe extern "system" fn(isize,isize)->i32,data:isize)->i32;
 fn IsWindowVisible(hwnd:isize)->i32;fn IsWindow(hwnd:isize)->i32;fn IsIconic(hwnd:isize)->i32;
 fn GetWindowTextW(hwnd:isize,text:*mut u16,count:i32)->i32;
 fn GetWindowThreadProcessId(hwnd:isize,pid:*mut u32)->u32;
 fn GetForegroundWindow()->isize;fn GetAsyncKeyState(key:i32)->i16;
 fn GetClientRect(hwnd:isize,rect:*mut Rect)->i32;fn ClientToScreen(hwnd:isize,point:*mut Point)->i32;
}
#[derive(Serialize)]pub struct WindowInfo{pub id:String,pub title:String,pub pid:u32}
pub fn enumerate()->Vec<WindowInfo>{let mut result=Vec::new();unsafe{EnumWindows(visit,&mut result as *mut Vec<WindowInfo> as isize);}result.sort_by(|a,b|a.title.cmp(&b.title));result}
unsafe extern "system" fn visit(hwnd:isize,data:isize)->i32{
 if IsWindowVisible(hwnd)==0||IsIconic(hwnd)!=0{return 1}let mut text=[0u16;1024];let len=GetWindowTextW(hwnd,text.as_mut_ptr(),text.len() as i32);let mut pid=0;GetWindowThreadProcessId(hwnd,&mut pid);
 if len>0&&pid!=std::process::id(){let result=&mut *(data as *mut Vec<WindowInfo>);result.push(WindowInfo{id:hwnd.to_string(),title:String::from_utf16_lossy(&text[..len as usize]),pid})}1
}
pub fn foreground()->isize{unsafe{GetForegroundWindow()}}
pub fn f8_down()->bool{unsafe{GetAsyncKeyState(0x77)<0}}
pub fn valid(hwnd:isize,pid:u32)->bool{unsafe{let mut current=0;GetWindowThreadProcessId(hwnd,&mut current);IsWindow(hwnd)!=0&&IsWindowVisible(hwnd)!=0&&IsIconic(hwnd)==0&&pid==current}}
pub fn client_rect(hwnd:isize)->Result<Rect,String>{unsafe{let mut r=Rect::default();let mut point=Point::default();if GetClientRect(hwnd,&mut r)==0||ClientToScreen(hwnd,&mut point)==0{return Err("Cannot read target bounds".into())}r.right+=point.x;r.bottom+=point.y;r.left=point.x;r.top=point.y;if r.right<=r.left||r.bottom<=r.top{return Err("Target has no visible client area".into())}Ok(r)}}
