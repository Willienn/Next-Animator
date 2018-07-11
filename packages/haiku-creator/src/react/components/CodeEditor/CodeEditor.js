/**
 * @file Work based on https://github.com/superRaytin/react-monaco-editor/blob/master/src/editor.js
 */

import * as React from 'react';
import * as Radium from 'radium';
import MonacoEditor from './MonacoEditor';
import SaveContentsPopup from './SaveContentsPopup';
import BytecodeErrorPopup from './BytecodeErrorPopup';

class CodeEditor extends React.Component {
  constructor (props) {
    super(props);

    this.onMonacoEditorChange = this.onMonacoEditorChange.bind(this);
    this.saveCodeFromEditorToDisk = this.saveCodeFromEditorToDisk.bind(this);
    this.onProjectModelUpdate = this.onProjectModelUpdate.bind(this);

    this.hideBytecodeErrorPopup = () => {
      this.setState({
        showBytecodeErrorPopup: false,
      });
    };

    this.state = {
      currentComponentCode: '',
      currentEditorContents: '',
      currentBytecodeError: null,
      showBytecodeErrorPopup: false,
    };
  }

  onProjectModelUpdate (what) {
    // Updates can take up a lot of CPU, especially for reloads which ultimately result in
    // a call to File#getCode, which is very heavy, so we don't listen unless we are
    // actually open, otherwise we get very bad UI jank when these updates happen.
    if (this.props.showGlass) {
      return;
    }

    switch (what) {
      case 'reloaded':
        this.performCodeReload();
        break;
    }
  }

  componentWillReceiveProps (nextProps) {
    // If we were made visible, we may need to force reload code in case we skipped
    // any updates while we weren't visible
    if (!nextProps.showGlass && this.props.showGlass !== nextProps.showGlass) {
      this.performCodeReload();
    }
  }

  componentDidMount () {
    if (this.props.projectModel) {
      // Reload monaco contents on component load (eg. changing active component, loading a new project, ..)
      this.props.projectModel.on('update', this.onProjectModelUpdate);
    }
  }

  componentWillUnmount () {
    if (this.props.projectModel) {
      this.props.projectModel.removeListener('update', this.onProjectModelUpdate);
    }
  }

  /**
   * Keep monaco component synced with states from CodeEditor (currentEditorContents) and
   * Stage (nonSavedContentOnCodeEditor).
   */
  onMonacoEditorChange (newContent) {
    this.setState({currentEditorContents: newContent}, () => {
      this.props.setNonSavedContentOnCodeEditor(this.state.currentComponentCode !== this.state.currentEditorContents);
    });
  }

  performCodeReload () {
    const ac = this.props.projectModel.getCurrentActiveComponent();

    if (!ac) {
      return;
    }

    const newComponentCode = ac.fetchActiveBytecodeFile().getCode();

    // If component code changed, update it on Editor
    // TODO: this logic could be migrated in the future to Monaco Editor
    // getDerivedStateFromProps on react 16+
    if (newComponentCode !== this.state.currentComponentCode) {
      // This probably is portable to getDerivedStateFromProps
      this.setState({currentComponentCode: newComponentCode, currentEditorContents: newComponentCode}, () => {
        this.onMonacoEditorChange(newComponentCode, null);
      });
    } else {
      this.setState({currentComponentCode: newComponentCode});
    }
  }

  saveCodeFromEditorToDisk () {
    const activeComponent = this.props.projectModel.getCurrentActiveComponent();
    if (!activeComponent) {
      return;
    }

    activeComponent.replaceBytecode(this.state.currentEditorContents, {from: 'creator'}, (error) => {
      this.setState({
        currentBytecodeError: error,
        showBytecodeErrorPopup: !!error,
      });

      if (!error) {
        this.setState({currentComponentCode: this.state.currentEditorContents}, () => {
          this.onMonacoEditorChange(this.state.currentEditorContents);
        });
      }
    });
  }

  render () {
    const monacoOptions = {
      language: 'javascript',
      lineNumbers: 'on',
      links: false,
      theme: 'haiku',
      minimap: {enabled: false},
      autoIndent: false,
      contextmenu: false,
      codeLens: false,
      parameterHints: false,
      cursorBlinking: 'blink',
      scrollBeyondLastLine: false,
    };

    return (
      <div style={{width: '100%', height: '100%'}}>
        {this.props.showPopupToSaveRawEditorContents &&
          <SaveContentsPopup
            projectModel={this.props.projectModel}
            targetComponentToChange={this.props.targetComponentToChange}
            setShowPopupToSaveRawEditorContents={this.props.setShowPopupToSaveRawEditorContents}
            saveCodeFromEditorToDisk={this.saveCodeFromEditorToDisk}
          />}
        {this.state.showBytecodeErrorPopup &&
          <BytecodeErrorPopup
            currentBytecodeError={this.state.currentBytecodeError}
            closeBytecodeErrorPopup={this.hideBytecodeErrorPopup}
          />}
        <MonacoEditor
          language="javascript"
          value={this.state.currentEditorContents}
          options={monacoOptions}
          style={{
            width: '100%',
            height: '100%',
          }}
          onChange={this.onMonacoEditorChange}
        />
      </div>
    );
  }
}

export default Radium(CodeEditor);