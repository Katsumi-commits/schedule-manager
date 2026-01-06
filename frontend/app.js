const { useState, useEffect } = React;
const API_URL = window.API_URL || 'https://gzx7nfaiyb.execute-api.ap-northeast-1.amazonaws.com/prod/';

function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [messages,setMessages] = useState([]);
  const [issues,setIssues] = useState([]);
  const [projects,setProjects] = useState([]);
  const [loading,setLoading] = useState(false);
  const [input,setInput] = useState('タイトル：\n担当：\n期間：');
  const [priority,setPriority] = useState('Medium');
  const [selectedProject,setSelectedProject] = useState('');
  const [showProjectModal,setShowProjectModal] = useState(false);
  const [newProjectName,setNewProjectName] = useState('');
  const [editingProject,setEditingProject] = useState(null);
  const [isRecording,setIsRecording] = useState(false);
  const [recognition,setRecognition] = useState(null);
  const [searchId,setSearchId] = useState('');
  const [dragState, setDragState] = useState(null);

  // 自然言語パース関数
  const parseNaturalLanguage = (text) => {
    // 「タイトル API実装 担当 石鍋 期間 今日から3日」形式をパース
    const titleMatch = text.match(/タイトル[：:\s]+([^担当期間]+?)(?=\s*担当|\s*期間|$)/i);
    const assigneeMatch = text.match(/担当[：:\s]+([^タイトル期間]+?)(?=\s*タイトル|\s*期間|$)/i);
    const periodMatch = text.match(/期間[：:\s]+([^タイトル担当]+?)(?=\s*タイトル|\s*担当|$)/i);
    
    let formatted = 'タイトル：';
    if (titleMatch) formatted += titleMatch[1].trim();
    formatted += '\n担当：';
    if (assigneeMatch) formatted += assigneeMatch[1].trim();
    formatted += '\n期間：';
    if (periodMatch) formatted += periodMatch[1].trim();
    
    return formatted;
  };

  useEffect(()=>{ 
    loadIssues(); 
    loadProjects();
    initSpeechRecognition();
  },[]);
  
  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ja-JP';
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const formatted = parseNaturalLanguage(transcript);
        setInput(formatted);
        setIsRecording(false);
      };
      
      recognition.onerror = () => {
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognition);
    }
  };
  
  const toggleRecording = () => {
    if (!recognition) {
      alert('音声認識がサポートされていません');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };
  
  const loadProjects = async () => {
    try {
      console.log('Loading projects from:', API_URL+'projects');
      const res = await fetch(API_URL+'projects');
      console.log('Projects response status:', res.status);
      const data = await res.json();
      console.log('Projects data:', data);
      if (Array.isArray(data)) {
        setProjects(data);
        if(data.length > 0 && !selectedProject) setSelectedProject(data[0].id);
      } else {
        setProjects([{id: 'default', name: 'Default Project'}]);
        setSelectedProject('default');
      }
    } catch(e){ 
      console.error('Load projects error:', e); 
      setProjects([{id: 'default', name: 'Default Project'}]);
      setSelectedProject('default');
    }
  };
  
  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch(API_URL+'projects', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newProjectName})
      });
      const data = await res.json();
      if (data.success) {
        loadProjects();
        setNewProjectName('');
        setShowProjectModal(false);
      }
    } catch(e) { console.error(e); }
  };
  
  const updateProject = async () => {
    if (!newProjectName.trim() || !editingProject) return;
    try {
      const res = await fetch(API_URL+'projects/'+editingProject.id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newProjectName})
      });
      const data = await res.json();
      if (data.success) {
        loadProjects();
        setNewProjectName('');
        setEditingProject(null);
        setShowProjectModal(false);
      }
    } catch(e) { console.error(e); }
  };
  
  const openProjectModal = (project = null) => {
    setEditingProject(project);
    setNewProjectName(project ? project.name : '');
    setShowProjectModal(true);
  };
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      
      const deltaX = e.clientX - dragState.startX;
      const gridDelta = Math.round(deltaX / 30); // 30px grid
      
      if (Math.abs(gridDelta) < 1) return;
      
      const issue = dragState.issue;
      const today = new Date();
      today.setHours(0,0,0,0);
      const taskStartDate = new Date(issue.startDate || today);
      const taskEndDate = new Date(issue.endDate || new Date(today.getTime() + 3*24*60*60*1000));
      
      if (dragState.type === 'move') {
        const newStart = new Date(taskStartDate.getTime() + gridDelta * 24*60*60*1000);
        const duration = taskEndDate - taskStartDate;
        const newEnd = new Date(newStart.getTime() + duration);
        
        updateTaskDates(issue.id, issue.createdAt, newStart.toISOString().split('T')[0], newEnd.toISOString().split('T')[0]);
      } else if (dragState.type === 'resize') {
        const newEnd = new Date(taskEndDate.getTime() + gridDelta * 24*60*60*1000);
        if (newEnd > taskStartDate) {
          updateTaskDates(issue.id, issue.createdAt, taskStartDate.toISOString().split('T')[0], newEnd.toISOString().split('T')[0]);
        }
      }
      
      setDragState(null);
    };
    
    const handleMouseUp = () => {
      setDragState(null);
    };
    
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState]);
  
  const loadIssues = async () => {
    try {
      console.log('Loading issues from:', API_URL+'issues');
      const res = await fetch(API_URL+'issues');
      console.log('Issues response status:', res.status);
      const data = await res.json();
      console.log('Issues data:', data);
      setIssues(Array.isArray(data) ? data : []);
    } catch(e){ 
      console.error('Load issues error:', e); 
      setIssues([]);
    }
  };

  const getPriorityText = (priority) => ({1: 'Low', 2: 'Medium', 3: 'High'}[priority] || 'Medium');
  const getStatusColor = (status) => ({'Open': '#999', 'In Progress': '#007bff', 'Review': '#e83e8c', 'Closed': '#28a745'}[status] || '#999');
  const getAssigneeColor = (assignee) => {
    const colors = ['#fd7e14', '#6f42c1', '#20c997', '#ffc107', '#dc3545'];
    const hash = assignee.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    return colors[Math.abs(hash) % colors.length];
  };
  const getNextStatus = (currentStatus) => ({'Open': 'In Progress', 'In Progress': 'Review', 'Review': 'Closed'}[currentStatus] || 'In Progress');
  const isHoliday = (date) => {
    const day = date.getDay();
    if(day >= 5) return true;
    const month = date.getMonth() + 1, dayOfMonth = date.getDate();
    return (month === 1 && dayOfMonth <= 3) || (month === 2 && [11,23].includes(dayOfMonth)) ||
           (month === 3 && dayOfMonth === 20) || (month === 4 && dayOfMonth === 29) ||
           (month === 5 && [3,4,5].includes(dayOfMonth)) || (month === 7 && dayOfMonth === 15) ||
           (month === 8 && dayOfMonth === 11) || (month === 9 && [16,23].includes(dayOfMonth)) ||
           (month === 10 && dayOfMonth === 14) || (month === 11 && [3,23].includes(dayOfMonth)) ||
           (month === 12 && dayOfMonth >= 23);
  };

  const updateTaskDates = async (taskId, createdAt, startDate, endDate) => {
    try {
      await fetch(API_URL+'issues/'+taskId, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({startDate, endDate, createdAt})
      });
      loadIssues();
    } catch(e) { console.error(e); }
  };

  const updateTaskStatus = async (taskId, createdAt, newStatus) => {
    try {
      await fetch(API_URL+'issues/'+taskId, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: newStatus, createdAt})
      });
      loadIssues();
    } catch(e) { console.error(e); }
  };

  const deleteTask = async (taskId, createdAt) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await fetch(API_URL+'issues/'+taskId, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({createdAt})
      });
      loadIssues();
    } catch(e) { console.error(e); }
  };

  const sendFormattedMessage = async () => {
    if(!input.trim() || !selectedProject) return;
    setMessages(prev=>[...prev,{type:'user',content:input}]);
    const message = input;
    setInput('タイトル：\n担当：\n期間：'); 
    setLoading(true);
    try {
      const res = await fetch(API_URL+'chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          messages: [{
            role: 'user',
            content: message
          }],
          priority,
          projectId: selectedProject
        })
      });
      const data = await res.json();
      if(data.success && data.issueId){
        setMessages(prev=>[...prev,{type:'assistant',content:'Task #'+(data.issueId||'unknown').slice(-8)+' created successfully!'}]);
        loadIssues();
      } else {
        setMessages(prev=>[...prev,{type:'assistant',content:data.message || data.error || 'Sorry, I could not process that request.'}]);
      }
    } catch(e){
      console.error('Chat error:', e);
      setMessages(prev=>[...prev,{type:'assistant',content:'Error processing request.'}]);
    }
    setLoading(false);
  };

  const renderPage = () => {
    if(currentPage === 'chat') {
      return (
        <div>
          <div className="project-selector">
            <label>📁 プロジェクト:</label>
            <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} disabled={loading}>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <button onClick={()=>openProjectModal()} className="project-btn">➕ 新規</button>
            <button onClick={()=>openProjectModal(projects.find(p=>p.id===selectedProject))} className="project-btn">✏️ 編集</button>
          </div>
          
          {showProjectModal && (
            <div className="modal-overlay" onClick={()=>setShowProjectModal(false)}>
              <div className="modal" onClick={e=>e.stopPropagation()}>
                <h3>{editingProject ? 'プロジェクト編集' : '新規プロジェクト'}</h3>
                <input 
                  value={newProjectName} 
                  onChange={e=>setNewProjectName(e.target.value)} 
                  placeholder="プロジェクト名"
                  style={{width:'100%', marginBottom:'15px', padding:'12px', border:'2px solid #e1e8ed', borderRadius:'8px'}}
                  onKeyDown={e=>{
                    if(e.key==='Enter') {
                      e.preventDefault();
                      editingProject ? updateProject() : createProject();
                    }
                  }}
                />
                <div className="modal-buttons">
                  <button 
                    onClick={editingProject ? updateProject : createProject} 
                    disabled={!newProjectName.trim()}
                    style={{marginRight:'10px'}}
                  >
                    {editingProject ? '更新' : '作成'}
                  </button>
                  <button onClick={()=>{
                    setShowProjectModal(false);
                    setEditingProject(null);
                    setNewProjectName('');
                  }} className="cancel-btn">キャンセル</button>
                </div>
              </div>
            </div>
          )}
          
          <div className="chat-container">
            {messages.map((msg,idx)=><div key={idx} className={'message '+msg.type}>{msg.content}</div>)}
            {loading&&<div className="message assistant">Processing...</div>}
          </div>
          <div className="input-row">
            <textarea 
              placeholder="タイトル：\n担当：\n期間：" 
              value={input} 
              onChange={e=>setInput(e.target.value)} 
              onKeyDown={e=>{
                if(e.key==='Enter' && e.shiftKey) {
                  e.preventDefault();
                  sendFormattedMessage();
                }
              }}
              disabled={loading} 
              className="task-input"
              rows={6}
            />
            <div className="input-controls">
              <button 
                onClick={toggleRecording} 
                disabled={loading}
                className={`voice-btn ${isRecording ? 'recording' : ''}`}
                title="音声入力"
              >
                {isRecording ? '🔴' : '🎤'}
              </button>
              <select value={priority} onChange={e=>setPriority(e.target.value)} disabled={loading} className="priority-select">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <button onClick={sendFormattedMessage} disabled={loading||!input.trim()||!selectedProject} className="submit-btn">タスク作成</button>
        </div>
      );
    }
    
    if(currentPage === 'tasks') {
      const groupedIssues = issues.reduce((groups, issue) => {
        const projectId = issue.projectId || 'default';
        if (!groups[projectId]) groups[projectId] = [];
        groups[projectId].push(issue);
        return groups;
      }, {});
      
      return (
        <div className="issues">
          <h2>All Tasks ({issues.length})</h2>
          <input value={searchId} onChange={e=>setSearchId(e.target.value)} placeholder="Search by Task ID" style={{width:'100%', marginBottom:'20px', padding:'8px', border:'1px solid #ddd', borderRadius:'4px'}}/>
          {Object.entries(groupedIssues).map(([projectId, projectIssues]) => {
            const project = projects.find(p => p.id === projectId) || {name: 'Unknown Project'};
            return (
              <div key={projectId} className="project-group">
                <h3 className="project-title">📁 {project.name} ({projectIssues.length})</h3>
                {projectIssues.filter(issue=>!searchId||issue.id.includes(searchId)).map(issue=>(
                  <div key={issue.id} className="issue">
                    <div className="issue-title">{issue.title}</div>
                    <div style={{fontSize:'12px', color:'#666', marginBottom:'5px'}}>#{issue.id.slice(-8)}</div>
                    <div className="issue-meta">
                      担当: {issue.assigneeId} | 期間: {issue.startDate} - {issue.endDate} | 優先度: {getPriorityText(issue.priority)}
                      <button 
                        onClick={() => deleteTask(issue.id, issue.createdAt)}
                        className="delete-btn"
                        style={{marginLeft:'10px', padding:'2px 6px', fontSize:'12px'}}
                        title="削除"
                      >🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    }
    
    if(currentPage === 'gantt') {
      const FIXED_DAY_COUNT = 60;
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const allDates = issues.flatMap(issue => [
        new Date(issue.startDate || today),
        new Date(issue.endDate || new Date(today.getTime() + 3*24*60*60*1000))
      ]);
      const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(today.getTime() - 30*24*60*60*1000);
      const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date(today.getTime() + 30*24*60*60*1000);
      
      const startDate = new Date(Math.min(today.getTime() - 15*24*60*60*1000, minDate.getTime() - 7*24*60*60*1000));
      startDate.setHours(0,0,0,0);
      
      const days = Array.from({length: FIXED_DAY_COUNT}, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        return date;
      });
      
      const handleMouseDown = (e, issue, type) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState({issue, type, startX: e.clientX});
      };
      
      return (
        <div className="gantt-container">
          <div className="gantt-wrapper">
            <div className="gantt-tasks-column">
              <div className="gantt-task-header">📋 Task</div>
              {issues.sort((a,b) => a.assigneeId.localeCompare(b.assigneeId)).map(issue => (
                <div key={issue.id} className="gantt-task-cell">
                  <div className="task-title" title={issue.title}>{issue.title}</div>
                  <div className="task-actions">
                    <span className="task-id">#{issue.id.slice(-8)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="gantt-timeline-wrapper">
              <div className="gantt-timeline-header">
                {days.map(day => (
                  <div key={day.toISOString()} className={`gantt-day-header ${isHoliday(day) ? 'holiday' : ''}`}>
                    {String(day.getMonth()+1).padStart(2,'0')}/{String(day.getDate()).padStart(2,'0')}
                  </div>
                ))}
              </div>
              <div className="gantt-timeline-content">
                {issues.sort((a,b) => a.assigneeId.localeCompare(b.assigneeId)).map((issue, index) => {
                  const taskStartDate = new Date(issue.startDate || today);
                  taskStartDate.setHours(0,0,0,0);
                  const taskEndDate = new Date(issue.endDate || new Date(today.getTime() + 3*24*60*60*1000));
                  taskEndDate.setHours(0,0,0,0);
                  const duration = Math.max(1, Math.ceil((taskEndDate - taskStartDate) / (24*60*60*1000)) + 1);
                  const startOffset = Math.floor((taskStartDate - startDate) / (24*60*60*1000));
                  
                  if (startOffset >= FIXED_DAY_COUNT || startOffset + duration < 0) return null;
                  
                  return (
                    <div key={issue.id} className="gantt-row" style={{top: index * 60 + 'px'}}>
                      <div 
                        className="gantt-bar"
                        style={{
                          left: Math.max(0, startOffset * 30) + 'px',
                          width: Math.min(duration * 30, (FIXED_DAY_COUNT - Math.max(0, startOffset)) * 30) + 'px'
                        }}
                        onDoubleClick={()=>{
                          const nextStatus = getNextStatus(issue.status);
                          if(nextStatus) updateTaskStatus(issue.id, issue.createdAt, nextStatus);
                        }}
                      >
                        <div 
                          className="gantt-bar-content"
                          style={{background: getStatusColor(issue.status)}}
                          onMouseDown={(e) => handleMouseDown(e, issue, 'move')}
                        >
                          <span className="gantt-bar-text">{issue.status}</span>
                        </div>
                        <div 
                          className="gantt-resize-handle"
                          style={{background: getAssigneeColor(issue.assigneeId)}}
                          onMouseDown={(e) => handleMouseDown(e, issue, 'resize')}
                          title={`担当: ${issue.assigneeId}`}
                        >
                          ⋮⋮
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="container">
      <h1>AI Task Manager</h1>
      
      <div className="nav-container">
        <button 
          className={`nav-button ${currentPage==='chat'?'active':''}`}
          onClick={()=>setCurrentPage('chat')}>
          💬 Chat
        </button>
        <button 
          className={`nav-button ${currentPage==='tasks'?'active':''}`}
          onClick={()=>setCurrentPage('tasks')}>
          📋 Tasks
        </button>
        <button 
          className={`nav-button ${currentPage==='gantt'?'active':''}`}
          onClick={()=>setCurrentPage('gantt')}>
          📊 Gantt Chart
        </button>
      </div>
      
      {renderPage()}
    </div>
  );
}

ReactDOM.render(<App/>,document.getElementById('root'));