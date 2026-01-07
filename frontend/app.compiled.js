const {
  useState,
  useEffect
} = React;
const API_URL = window.API_URL;
if (!API_URL) {
  console.error('API_URL not found. Please check config.js is loaded.');
}
function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('タイトル：\n担当：\n期間：');
  const [priority, setPriority] = useState('Medium');
  const [selectedProject, setSelectedProject] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [hideClosedTasks, setHideClosedTasks] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [dragState, setDragState] = useState(null);

  // 自然言語パース関数
  const parseNaturalLanguage = text => {
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
  useEffect(() => {
    loadIssues();
    loadProjects();
    initSpeechRecognition();
  }, []);
  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ja-JP';
      recognition.onresult = event => {
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
      console.log('Loading projects from:', API_URL + 'projects');
      const res = await fetch(API_URL + 'projects');
      console.log('Projects response status:', res.status);
      const data = await res.json();
      console.log('Projects data:', data);
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length > 0 && !selectedProject) setSelectedProject(data[0].id);
      } else {
        setProjects([{
          id: 'default',
          name: 'Default Project'
        }]);
        setSelectedProject('default');
      }
    } catch (e) {
      console.error('Load projects error:', e);
      setProjects([{
        id: 'default',
        name: 'Default Project'
      }]);
      setSelectedProject('default');
    }
  };
  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch(API_URL + 'projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newProjectName
        })
      });
      const data = await res.json();
      if (data.success) {
        loadProjects();
        setNewProjectName('');
        setShowProjectModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };
  const updateProject = async () => {
    if (!newProjectName.trim() || !editingProject) return;
    try {
      const res = await fetch(API_URL + 'projects/' + editingProject.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newProjectName
        })
      });
      const data = await res.json();
      if (data.success) {
        loadProjects();
        setNewProjectName('');
        setEditingProject(null);
        setShowProjectModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };
  const openProjectModal = (project = null) => {
    setEditingProject(project);
    setNewProjectName(project ? project.name : '');
    setShowProjectModal(true);
  };
  useEffect(() => {
    const handleMouseMove = e => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      const gridDelta = Math.round(deltaX / 30); // 30px grid

      if (Math.abs(gridDelta) < 1) return;
      const issue = dragState.issue;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const taskStartDate = new Date(issue.startDate || today);
      const taskEndDate = new Date(issue.endDate || new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000));
      if (dragState.type === 'move') {
        const newStart = new Date(taskStartDate.getTime() + gridDelta * 24 * 60 * 60 * 1000);
        const duration = taskEndDate - taskStartDate;
        const newEnd = new Date(newStart.getTime() + duration);
        updateTaskDates(issue.id, issue.createdAt, newStart.toISOString().split('T')[0], newEnd.toISOString().split('T')[0]);
      } else if (dragState.type === 'resize') {
        const newEnd = new Date(taskEndDate.getTime() + gridDelta * 24 * 60 * 60 * 1000);
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
      console.log('Loading issues from:', API_URL + 'issues');
      const res = await fetch(API_URL + 'issues');
      console.log('Issues response status:', res.status);
      const data = await res.json();
      console.log('Issues data:', data);
      setIssues(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load issues error:', e);
      setIssues([]);
    }
  };
  const getPriorityText = priority => ({
    1: 'Low',
    2: 'Medium',
    3: 'High'
  })[priority] || 'Medium';
  const getStatusColor = status => ({
    'Open': '#999',
    'In Progress': '#007bff',
    'Review': '#e83e8c',
    'Closed': '#28a745'
  })[status] || '#999';
  const getAssigneeColor = assignee => {
    const colors = ['#fd7e14', '#6f42c1', '#20c997', '#ffc107', '#dc3545'];
    const hash = assignee.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };
  const getNextStatus = currentStatus => ({
    'Open': 'In Progress',
    'In Progress': 'Review',
    'Review': 'Closed'
  })[currentStatus] || 'In Progress';
  const isHoliday = date => {
    const day = date.getDay();
    if (day === 0 || day === 6) return true; // 土日

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();

    // 2026年の祝日
    if (year === 2026) {
      const holidays = [[1, 1],
      // 元日
      [1, 12],
      // 成人の日（第2月曜日）
      [2, 11],
      // 建国記念の日
      [2, 23],
      // 天皇誕生日
      [3, 20],
      // 春分の日
      [4, 29],
      // 昭和の日
      [5, 3],
      // 憲法記念日
      [5, 4],
      // みどりの日
      [5, 5],
      // こどもの日
      [7, 20],
      // 海の日（第3月曜日）
      [8, 11],
      // 山の日
      [9, 21],
      // 敬老の日（第3月曜日）
      [9, 23],
      // 秋分の日
      [10, 12],
      // スポーツの日（第2月曜日）
      [11, 3],
      // 文化の日
      [11, 23],
      // 勤労感謝の日
      [12, 29], [12, 30], [12, 31] // 年末休暇
      ];
      return holidays.some(([m, d]) => month === m && dayOfMonth === d);
    }

    // その他の年は基本的な祝日のみ
    return month === 1 && dayOfMonth === 1 ||
    // 元日
    month === 2 && dayOfMonth === 11 ||
    // 建国記念の日
    month === 4 && dayOfMonth === 29 ||
    // 昭和の日
    month === 5 && [3, 4, 5].includes(dayOfMonth) ||
    // GW
    month === 8 && dayOfMonth === 11 ||
    // 山の日
    month === 11 && [3, 23].includes(dayOfMonth) ||
    // 文化の日、勤労感謝の日
    month === 12 && dayOfMonth >= 29; // 年末
  };
  const updateTaskDates = async (taskId, createdAt, startDate, endDate) => {
    try {
      await fetch(API_URL + 'issues/' + taskId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate,
          endDate,
          createdAt
        })
      });
      loadIssues();
    } catch (e) {
      console.error(e);
    }
  };
  const updateTaskStatus = async (taskId, createdAt, newStatus) => {
    try {
      await fetch(API_URL + 'issues/' + taskId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          createdAt
        })
      });
      loadIssues();
    } catch (e) {
      console.error(e);
    }
  };
  const deleteTask = async (taskId, createdAt) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await fetch(API_URL + 'issues/' + taskId, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          createdAt
        })
      });
      loadIssues();
    } catch (e) {
      console.error(e);
    }
  };
  const sendFormattedMessage = async () => {
    if (!input.trim() || !selectedProject) return;
    setMessages(prev => [...prev, {
      type: 'user',
      content: input
    }]);
    const message = input;
    setInput('タイトル：\n担当：\n期間：');
    setLoading(true);
    try {
      const res = await fetch(API_URL + 'chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          priority,
          projectId: selectedProject
        })
      });
      const data = await res.json();
      if (data.success && data.issueId) {
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: 'Task #' + (data.issueId || 'unknown').slice(-8) + ' created successfully!'
        }]);
        loadIssues();
      } else {
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: data.message || data.error || 'Sorry, I could not process that request.'
        }]);
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'Error processing request.'
      }]);
    }
    setLoading(false);
  };
  const renderPage = () => {
    if (currentPage === 'chat') {
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "project-selector"
      }, /*#__PURE__*/React.createElement("label", null, "\uD83D\uDCC1 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8:"), /*#__PURE__*/React.createElement("select", {
        value: selectedProject,
        onChange: e => setSelectedProject(e.target.value),
        disabled: loading
      }, projects.map(project => /*#__PURE__*/React.createElement("option", {
        key: project.id,
        value: project.id
      }, project.name))), /*#__PURE__*/React.createElement("button", {
        onClick: () => openProjectModal(),
        className: "project-btn"
      }, "\u2795 \u65B0\u898F"), /*#__PURE__*/React.createElement("button", {
        onClick: () => openProjectModal(projects.find(p => p.id === selectedProject)),
        className: "project-btn"
      }, "\u270F\uFE0F \u7DE8\u96C6")), showProjectModal && /*#__PURE__*/React.createElement("div", {
        className: "modal-overlay",
        onClick: () => setShowProjectModal(false)
      }, /*#__PURE__*/React.createElement("div", {
        className: "modal",
        onClick: e => e.stopPropagation()
      }, /*#__PURE__*/React.createElement("h3", null, editingProject ? 'プロジェクト編集' : '新規プロジェクト'), /*#__PURE__*/React.createElement("input", {
        value: newProjectName,
        onChange: e => setNewProjectName(e.target.value),
        placeholder: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D",
        style: {
          width: '100%',
          marginBottom: '15px',
          padding: '12px',
          border: '2px solid #e1e8ed',
          borderRadius: '8px'
        },
        onKeyDown: e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editingProject ? updateProject() : createProject();
          }
        }
      }), /*#__PURE__*/React.createElement("div", {
        className: "modal-buttons"
      }, /*#__PURE__*/React.createElement("button", {
        onClick: editingProject ? updateProject : createProject,
        disabled: !newProjectName.trim(),
        style: {
          marginRight: '10px'
        }
      }, editingProject ? '更新' : '作成'), /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setShowProjectModal(false);
          setEditingProject(null);
          setNewProjectName('');
        },
        className: "cancel-btn"
      }, "\u30AD\u30E3\u30F3\u30BB\u30EB")))), /*#__PURE__*/React.createElement("div", {
        className: "chat-container"
      }, messages.map((msg, idx) => /*#__PURE__*/React.createElement("div", {
        key: idx,
        className: 'message ' + msg.type
      }, msg.content)), loading && /*#__PURE__*/React.createElement("div", {
        className: "message assistant"
      }, "Processing...")), /*#__PURE__*/React.createElement("div", {
        className: "input-row"
      }, /*#__PURE__*/React.createElement("textarea", {
        placeholder: "\u30BF\u30A4\u30C8\u30EB\uFF1A\\n\u62C5\u5F53\uFF1A\\n\u671F\u9593\uFF1A",
        value: input,
        onChange: e => setInput(e.target.value),
        onKeyDown: e => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            sendFormattedMessage();
          }
        },
        disabled: loading,
        className: "task-input",
        rows: 6
      }), /*#__PURE__*/React.createElement("div", {
        className: "input-controls"
      }, /*#__PURE__*/React.createElement("button", {
        onClick: toggleRecording,
        disabled: loading,
        className: `voice-btn ${isRecording ? 'recording' : ''}`,
        title: "\u97F3\u58F0\u5165\u529B"
      }, isRecording ? '🔴' : '🎤'), /*#__PURE__*/React.createElement("select", {
        value: priority,
        onChange: e => setPriority(e.target.value),
        disabled: loading,
        className: "priority-select"
      }, /*#__PURE__*/React.createElement("option", {
        value: "Low"
      }, "Low"), /*#__PURE__*/React.createElement("option", {
        value: "Medium"
      }, "Medium"), /*#__PURE__*/React.createElement("option", {
        value: "High"
      }, "High")))), /*#__PURE__*/React.createElement("button", {
        onClick: sendFormattedMessage,
        disabled: loading || !input.trim() || !selectedProject,
        className: "submit-btn"
      }, "\u30BF\u30B9\u30AF\u4F5C\u6210"));
    }
    if (currentPage === 'tasks') {
      const groupedIssues = issues.reduce((groups, issue) => {
        const projectId = issue.projectId || 'default';
        if (!groups[projectId]) groups[projectId] = [];
        groups[projectId].push(issue);
        return groups;
      }, {});
      return /*#__PURE__*/React.createElement("div", {
        className: "issues"
      }, /*#__PURE__*/React.createElement("h2", null, "All Tasks (", issues.length, ")"), /*#__PURE__*/React.createElement("input", {
        value: searchId,
        onChange: e => setSearchId(e.target.value),
        placeholder: "Search by Task ID",
        style: {
          width: '100%',
          marginBottom: '20px',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }
      }), Object.entries(groupedIssues).map(([projectId, projectIssues]) => {
        const project = projects.find(p => p.id === projectId) || {
          name: 'Unknown Project'
        };
        return /*#__PURE__*/React.createElement("div", {
          key: projectId,
          className: "project-group"
        }, /*#__PURE__*/React.createElement("h3", {
          className: "project-title"
        }, "\uD83D\uDCC1 ", project.name, " (", projectIssues.length, ")"), projectIssues.filter(issue => !searchId || issue.id.includes(searchId)).map(issue => /*#__PURE__*/React.createElement("div", {
          key: issue.id,
          className: "issue"
        }, /*#__PURE__*/React.createElement("div", {
          className: "issue-title"
        }, issue.title), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: '12px',
            color: '#666',
            marginBottom: '5px'
          }
        }, "#", issue.id.slice(-8)), /*#__PURE__*/React.createElement("div", {
          className: "issue-meta"
        }, "\u62C5\u5F53: ", issue.assigneeId, " | \u671F\u9593: ", issue.startDate, " - ", issue.endDate, " | \u512A\u5148\u5EA6: ", getPriorityText(issue.priority), /*#__PURE__*/React.createElement("button", {
          onClick: () => deleteTask(issue.id, issue.createdAt),
          className: "delete-btn",
          style: {
            marginLeft: '10px',
            padding: '2px 6px',
            fontSize: '12px'
          },
          title: "\u524A\u9664"
        }, "\uD83D\uDDD1\uFE0F")))));
      }));
    }
    if (currentPage === 'gantt') {
      const FIXED_DAY_COUNT = 60;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter issues by selected project and assignee
      let filteredIssues = issues.filter(issue => issue.projectId === selectedProject);
      if (selectedAssignee) {
        filteredIssues = filteredIssues.filter(issue => issue.assigneeId === selectedAssignee);
      }
      if (hideClosedTasks) {
        filteredIssues = filteredIssues.filter(issue => issue.status !== 'Closed');
      }

      // Sort by start date
      filteredIssues.sort((a, b) => {
        const dateA = new Date(a.startDate || today);
        const dateB = new Date(b.startDate || today);
        return dateA - dateB;
      });

      // Get unique assignees for the selected project
      const assignees = [...new Set(issues.filter(issue => issue.projectId === selectedProject).map(issue => issue.assigneeId))];
      const allDates = filteredIssues.flatMap(issue => [new Date(issue.startDate || today), new Date(issue.endDate || new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000))]);
      const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const startDate = new Date(Math.min(today.getTime() - 15 * 24 * 60 * 60 * 1000, minDate.getTime() - 7 * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
      const days = Array.from({
        length: FIXED_DAY_COUNT
      }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        return date;
      });
      const handleMouseDown = (e, issue, type) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState({
          issue,
          type,
          startX: e.clientX
        });
      };
      return /*#__PURE__*/React.createElement("div", {
        className: "gantt-container"
      }, /*#__PURE__*/React.createElement("div", {
        className: "project-selector"
      }, /*#__PURE__*/React.createElement("label", null, "\uD83D\uDCC1 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8:"), /*#__PURE__*/React.createElement("select", {
        value: selectedProject,
        onChange: e => setSelectedProject(e.target.value)
      }, projects.map(project => /*#__PURE__*/React.createElement("option", {
        key: project.id,
        value: project.id
      }, project.name))), /*#__PURE__*/React.createElement("label", null, "\uD83D\uDC64 \u62C5\u5F53\u8005:"), /*#__PURE__*/React.createElement("select", {
        value: selectedAssignee,
        onChange: e => setSelectedAssignee(e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "\u5168\u54E1"), assignees.map(assignee => /*#__PURE__*/React.createElement("option", {
        key: assignee,
        value: assignee
      }, assignee))), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: hideClosedTasks,
        onChange: e => setHideClosedTasks(e.target.checked)
      }), "Closed\u30BF\u30B9\u30AF\u3092\u975E\u8868\u793A")), /*#__PURE__*/React.createElement("div", {
        className: "gantt-wrapper"
      }, /*#__PURE__*/React.createElement("div", {
        className: "gantt-tasks-column"
      }, /*#__PURE__*/React.createElement("div", {
        className: "gantt-task-header"
      }, "\uD83D\uDCCB Task"), filteredIssues.map(issue => /*#__PURE__*/React.createElement("div", {
        key: issue.id,
        className: "gantt-task-cell"
      }, /*#__PURE__*/React.createElement("div", {
        className: "task-title",
        title: issue.title
      }, issue.title), /*#__PURE__*/React.createElement("div", {
        className: "task-actions"
      }, /*#__PURE__*/React.createElement("span", {
        className: "task-id"
      }, "#", issue.id.slice(-8)))))), /*#__PURE__*/React.createElement("div", {
        className: "gantt-timeline-wrapper"
      }, /*#__PURE__*/React.createElement("div", {
        className: "gantt-timeline-header"
      }, days.map(day => /*#__PURE__*/React.createElement("div", {
        key: day.toISOString(),
        className: `gantt-day-header ${isHoliday(day) ? 'holiday' : ''}`
      }, String(day.getMonth() + 1).padStart(2, '0'), "/", String(day.getDate()).padStart(2, '0')))), /*#__PURE__*/React.createElement("div", {
        className: "gantt-timeline-content"
      }, filteredIssues.map((issue, index) => {
        const taskStartDate = new Date(issue.startDate || today);
        taskStartDate.setHours(0, 0, 0, 0);
        const taskEndDate = new Date(issue.endDate || new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000));
        taskEndDate.setHours(0, 0, 0, 0);
        const duration = Math.max(1, Math.ceil((taskEndDate - taskStartDate) / (24 * 60 * 60 * 1000)) + 1);
        const startOffset = Math.floor((taskStartDate - startDate) / (24 * 60 * 60 * 1000));
        if (startOffset >= FIXED_DAY_COUNT || startOffset + duration < 0) return null;
        return /*#__PURE__*/React.createElement("div", {
          key: issue.id,
          className: "gantt-row",
          style: {
            top: index * 40 + 'px'
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "gantt-bar",
          style: {
            left: Math.max(0, startOffset * 30) + 'px',
            width: Math.min(duration * 30, (FIXED_DAY_COUNT - Math.max(0, startOffset)) * 30) + 'px'
          },
          onDoubleClick: () => {
            const nextStatus = getNextStatus(issue.status);
            if (nextStatus) updateTaskStatus(issue.id, issue.createdAt, nextStatus);
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "gantt-bar-content",
          style: {
            background: getStatusColor(issue.status)
          },
          onMouseDown: e => handleMouseDown(e, issue, 'move')
        }, /*#__PURE__*/React.createElement("span", {
          className: "gantt-bar-text"
        }, issue.status)), /*#__PURE__*/React.createElement("div", {
          className: "gantt-resize-handle",
          style: {
            background: getAssigneeColor(issue.assigneeId)
          },
          onMouseDown: e => handleMouseDown(e, issue, 'resize'),
          title: `担当: ${issue.assigneeId}`
        }, "\u22EE\u22EE")));
      })))));
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("h1", null, "AI Task Manager"), /*#__PURE__*/React.createElement("div", {
    className: "nav-container"
  }, /*#__PURE__*/React.createElement("button", {
    className: `nav-button ${currentPage === 'chat' ? 'active' : ''}`,
    onClick: () => setCurrentPage('chat')
  }, "\uD83D\uDCAC Chat"), /*#__PURE__*/React.createElement("button", {
    className: `nav-button ${currentPage === 'tasks' ? 'active' : ''}`,
    onClick: () => setCurrentPage('tasks')
  }, "\uD83D\uDCCB Tasks"), /*#__PURE__*/React.createElement("button", {
    className: `nav-button ${currentPage === 'gantt' ? 'active' : ''}`,
    onClick: () => setCurrentPage('gantt')
  }, "\uD83D\uDCCA Gantt Chart")), renderPage());
}
ReactDOM.render(/*#__PURE__*/React.createElement(App, null), document.getElementById('root'));